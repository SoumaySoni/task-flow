import { CheckSquare, LayoutDashboard, FolderKanban, Users, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { User } from '@supabase/supabase-js';
import { Avatar, AvatarFallback } from './ui/avatar';

interface SidebarProps {
  user: User | null;
  onSignOut: () => void;
}

const Sidebar = ({ user, onSignOut }: SidebarProps) => {
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <CheckSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            TaskFlow
          </h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 hover:bg-sidebar-accent"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 hover:bg-sidebar-accent"
        >
          <FolderKanban className="w-4 h-4" />
          Projects
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 hover:bg-sidebar-accent"
        >
          <Users className="w-4 h-4" />
          Team
        </Button>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
              {user?.email ? getInitials(user.email) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
