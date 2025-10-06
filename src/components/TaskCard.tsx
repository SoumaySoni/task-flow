import { useMemo, useState } from 'react';
import { MoreVertical, Trash2, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from './ui/avatar';
import TaskDetailsDialog from './TaskDetailsDialog';
import { useDraggable } from '@dnd-kit/core';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed';
  assigned_to: string | null;
  assignee?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
}

const TaskCard = ({ task, onRefresh }: TaskCardProps) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = useMemo(() => {
    return transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          opacity: isDragging ? 0.6 : 1,
        }
      : undefined;
  }, [transform, isDragging]);

  const handleDelete = async () => {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Task deleted',
      description: 'The task has been successfully deleted',
    });

    onRefresh();
  };

  const handleStatusChange = async (newStatus: 'todo' | 'in_progress' | 'completed') => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
      return;
    }

    onRefresh();
  };

  return (
    <>
      <Card
        className="shadow-card hover:shadow-hover transition-all cursor-pointer"
        onClick={() => setIsDetailsOpen(true)}
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base line-clamp-2">{task.title}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('todo');
                }}>
                  Move to To Do
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('in_progress');
                }}>
                  Move to In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('completed');
                }}>
                  Move to Completed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {task.description && (
            <CardDescription className="line-clamp-2">{task.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {task.assignee?.display_name ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                  {task.assignee.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{task.assignee.display_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Unassigned</span>
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailsDialog
        task={task}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onRefresh={onRefresh}
      />
    </>
  );
};

export default TaskCard;
