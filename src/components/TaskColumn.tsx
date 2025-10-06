import { Circle, Clock, CheckCircle2 } from 'lucide-react';
import TaskCard from './TaskCard';
import { useDroppable } from '@dnd-kit/core';

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

interface TaskColumnProps {
  title: string;
  status: 'todo' | 'in_progress' | 'completed';
  tasks: Task[];
  onRefresh: () => void;
}

const TaskColumn = ({ title, status, tasks, onRefresh }: TaskColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  const getIcon = () => {
    switch (status) {
      case 'todo':
        return <Circle className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
    }
  };

  const getHeaderColor = () => {
    switch (status) {
      case 'todo':
        return 'bg-muted';
      case 'in_progress':
        return 'bg-warning/10';
      case 'completed':
        return 'bg-success/10';
    }
  };

  return (
    <div className="flex flex-col h-full" ref={setNodeRef}>
      <div className={`${getHeaderColor()} rounded-lg p-3 mb-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {getIcon()}
          <h3 className="font-semibold">{title}</h3>
        </div>
        <span className="text-sm font-medium bg-background px-2 py-1 rounded">
          {tasks.length}
        </span>
      </div>

      <div className={`space-y-3 flex-1 overflow-y-auto ${isOver ? 'ring-2 ring-primary/40 rounded-md p-2 -m-2' : ''}`}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No tasks yet
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;
