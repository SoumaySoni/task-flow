import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback } from './ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';

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
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchComments();
      subscribeToComments();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {task.description && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          {task.assignee?.display_name && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Assigned to</h4>
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">
                    {task.assignee.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{task.assignee.display_name}</span>
              </div>
            </div>
          )}

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
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailsDialog;
