import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onProjectCreated: () => void;
}

const CreateProjectDialog = ({
  open,
  onOpenChange,
  userId,
  onProjectCreated,
}: CreateProjectDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);

    const { error } = await supabase.from('projects').insert({
      name,
      description: description || null,
      created_by: userId,
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Project Created',
      description: 'Your new project has been successfully created.',
    });

    setName('');
    setDescription('');
    onProjectCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] max-w-[700px] sm:w-full sm:max-w-2xl md:max-w-3xl 
          rounded-lg border border-border/50 bg-background/95 
          p-6 backdrop-blur transition-all duration-200
        "
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">New Project</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create a new project to organize your tasks, teams, and goals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing Website Redesign"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe this project (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
