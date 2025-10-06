import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  userId: string;
  onTaskCreated: () => void;
}

interface TeamMember {
  id: string;
  display_name: string | null;
}

const CreateTaskDialog = ({
  open,
  onOpenChange,
  projectId,
  userId,
  onTaskCreated,
}: CreateTaskDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'completed'>('todo');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase.from('profiles').select('id, display_name');

    if (!error && data) {
      setTeamMembers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setLoading(true);

    const { error } = await supabase.from('tasks').insert({
      title,
      description: description || null,
      status,
      project_id: projectId,
      assigned_to: assignedTo && assignedTo !== 'unassigned' ? assignedTo : null,
      created_by: userId,
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Task created',
      description: 'Your task has been successfully created',
    });

    setTitle('');
    setDescription('');
    setAssignedTo('');
    setStatus('todo');
    onTaskCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.display_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
