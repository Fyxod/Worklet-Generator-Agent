import { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Thread } from '@/types/thread';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  threads: Thread[];
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  selectedThreadId: string | null;
}

export const Sidebar = ({ threads, onNewThread, onSelectThread, selectedThreadId }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`h-screen bg-sidebar border-r border-sidebar-border transition-smooth ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-lg font-semibold text-sidebar-foreground">Threads</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        {/* New Thread Button */}
        <div className="p-4">
          <Button
            onClick={onNewThread}
            className="w-full gradient-primary hover:opacity-90 transition-smooth shadow-glow"
            size={collapsed ? 'icon' : 'default'}
          >
            <Plus className="h-5 w-5" />
            {!collapsed && <span className="ml-2">New Thread</span>}
          </Button>
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-4">
            {threads.map((thread) => (
              <button
                key={thread.thread_id}
                onClick={() => onSelectThread(thread.thread_id)}
                className={`w-full text-left p-3 rounded-lg transition-smooth ${
                  selectedThreadId === thread.thread_id
                    ? 'bg-sidebar-accent shadow-glow'
                    : 'hover:bg-sidebar-accent/50'
                } ${collapsed ? 'px-2' : ''}`}
              >
                {!collapsed ? (
                  <>
                    <div className="font-medium text-sidebar-foreground truncate">
                      {thread.thread_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Created {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-8 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
