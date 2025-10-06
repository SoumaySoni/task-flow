import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback } from './ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profile: {
    display_name: string | null;
  };
}

interface TaskDetailsDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const TaskDetailsDialog = ({ task, open, onOpenChange, onRefresh }: TaskDetailsDialogProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(task.title);
  const [editingDescription, setEditingDescription] = useState(task.description || '');
  const [editingStatus, setEditingStatus] = useState<Task['status']>(task.status);
  const [editingAssignee, setEditingAssignee] = useState<string>(task.assigned_to || 'unassigned');
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; display_name: string | null }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchComments();
      subscribeToComments();
      fetchTeamMembers();
      // reset editors to latest task data
      setEditingTitle(task.title);
      setEditingDescription(task.description || '');
      setEditingStatus(task.status);
      setEditingAssignee(task.assigned_to || 'unassigned');
    }
  }, [open, task.id]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        profile:profiles!task_comments_user_id_fkey(display_name)
      `)
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data as any);
    }
  };

  const subscribeToComments = () => {
    const channel = supabase
      .channel(`comments-${task.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${task.id}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('task_comments').insert({
      task_id: task.id,
      user_id: user.id,
      comment: newComment.trim(),
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
      return;
    }

    setNewComment('');
  };

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from('profiles').select('id, display_name');
    if (data) setTeamMembers(data as any);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: any = {
      title: editingTitle,
      description: editingDescription || null,
      status: editingStatus,
      assigned_to: editingAssignee && editingAssignee !== 'unassigned' ? editingAssignee : null,
    };
    const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: 'Task updated successfully' });
    onRefresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Title</label>
            <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <Textarea rows={3} value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Status</label>
              <Select value={editingStatus} onValueChange={(v: any) => setEditingStatus(v)}>
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
              <label className="text-sm font-semibold">Assignee</label>
              <Select value={editingAssignee} onValueChange={setEditingAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Comments</h4>
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                      {comment.profile.display_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">
                        {comment.profile.display_name || 'Unknown User'}
                      </p>
                      <p className="text-sm">{comment.comment}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmitComment} className="flex gap-2 pt-4 border-t">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailsDialog;
