import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
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
    if (selectedProject) {
      fetchTasks();
      subscribeToTasks();
    }
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

    // Fetch assignee details separately
    if (data) {
      const tasksWithAssignees = await Promise.all(
        data.map(async (task) => {
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', task.assigned_to)
              .single();
            
            return { ...task, assignee: profile };
          }
          return task;
        })
      );
      setTasks(tasksWithAssignees);
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
      .channel('tasks-changes')
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

  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

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
                tasks={todoTasks}
                onRefresh={fetchTasks}
              />
              <TaskColumn
                title="In Progress"
                status="in_progress"
                tasks={inProgressTasks}
                onRefresh={fetchTasks}
              />
              <TaskColumn
                title="Completed"
                status="completed"
                tasks={completedTasks}
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
