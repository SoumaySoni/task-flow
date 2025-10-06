import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import TaskColumn from './TaskColumn';
import CreateTaskDialog from './CreateTaskDialog';
import CreateProjectDialog from './CreateProjectDialog';
import { useToast } from '@/hooks/use-toast';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed';
  project_id: string;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface TaskBoardProps {
  user: User | null;
}

const TaskBoard = ({ user }: TaskBoardProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; display_name: string | null }[]>([]);
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    fetchTasks();
    const unsubscribe = subscribeToTasks();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [selectedProject]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch projects',
        variant: 'destructive',
      });
      return;
    }

    setProjects(data || []);
    if (data && data.length > 0 && !selectedProject) {
      setSelectedProject(data[0].id);
    }
  };

  const fetchTasks = async () => {
    if (!selectedProject) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', selectedProject)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
      return;
    }

    // Batch-load assignees to avoid N+1
    if (data) {
      const assignedIds = Array.from(new Set((data.map((t: any) => t.assigned_to).filter(Boolean)) as string[]));
      let profilesById: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', assignedIds as any);
        if (profiles) {
          profilesById = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
            return acc;
          }, {});
        }
      }

      const tasksWithAssignees = data.map((task: any) => ({
        ...task,
        assignee: task.assigned_to ? profilesById[task.assigned_to] : undefined,
      }));
      setTasks(tasksWithAssignees as any);

      // populate team members list (lightweight approach)
      const memberIds = Array.from(new Set((data.map((t: any) => t.assigned_to).filter(Boolean)) as string[]));
      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', memberIds as any);
        if (members) setTeamMembers(members as any);
      } else {
        setTeamMembers([]);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const draggedTaskId = String(active.id);
    const overId = String(over.id);
    const newStatus = (overId.replace('column-', '') as 'todo' | 'in_progress' | 'completed');

    const currentTask = tasks.find((t) => t.id === draggedTaskId);
    if (!currentTask || currentTask.status === newStatus) return;

    // Optimistic update
    const previousTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === draggedTaskId ? { ...t, status: newStatus } : t)));

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', draggedTaskId);

    if (error) {
      // Revert
      setTasks(previousTasks);
      toast({
        title: 'Error',
        description: 'Failed to move task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const subscribeToTasks = () => {
    if (!selectedProject) return;

    const channel = supabase
      .channel(`tasks-changes-${selectedProject}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${selectedProject}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleProjectCreated = () => {
    fetchProjects();
    setIsCreateProjectOpen(false);
  };

  const handleTaskCreated = () => {
    fetchTasks();
    setIsCreateTaskOpen(false);
  };

  const applyFilters = (list: Task[]) => {
    let filtered = list;
    if (assigneeFilter === 'unassigned') {
      filtered = filtered.filter((t) => !t.assigned_to);
    } else if (assigneeFilter !== 'all') {
      filtered = filtered.filter((t) => t.assigned_to === assigneeFilter);
    }
    if (myTasksOnly && user?.id) {
      filtered = filtered.filter((t) => t.assigned_to === user.id);
    }
    return filtered;
  };

  const todoTasks = applyFilters(tasks.filter((t) => t.status === 'todo'));
  const inProgressTasks = applyFilters(tasks.filter((t) => t.status === 'in_progress'));
  const completedTasks = applyFilters(tasks.filter((t) => t.status === 'completed'));
  const filterByQuery = (list: Task[]) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((t) =>
      t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    );
  };

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {projects.find((p) => p.id === selectedProject)?.name || 'Select a project'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your team's tasks and collaborate in real-time
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateProjectOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
            <Button onClick={() => setIsCreateTaskOpen(true)} disabled={!selectedProject}>
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant={selectedProject === project.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedProject(project.id)}
                className="whitespace-nowrap"
              >
                {project.name}
              </Button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full md:w-96 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Assignee</span>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="my-tasks" checked={myTasksOnly} onCheckedChange={setMyTasksOnly} />
            <label htmlFor="my-tasks" className="text-sm">My tasks</label>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {!selectedProject ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first project to start managing tasks
              </p>
              <Button onClick={() => setIsCreateProjectOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
              <TaskColumn
                title="To Do"
                status="todo"
                tasks={filterByQuery(todoTasks)}
                onRefresh={fetchTasks}
              />
              <TaskColumn
                title="In Progress"
                status="in_progress"
                tasks={filterByQuery(inProgressTasks)}
                onRefresh={fetchTasks}
              />
              <TaskColumn
                title="Completed"
                status="completed"
                tasks={filterByQuery(completedTasks)}
                onRefresh={fetchTasks}
              />
            </div>
          </DndContext>
        )}
      </div>

      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        projectId={selectedProject}
        userId={user?.id || ''}
        onTaskCreated={handleTaskCreated}
      />

      <CreateProjectDialog
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        userId={user?.id || ''}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};

export default TaskBoard;
