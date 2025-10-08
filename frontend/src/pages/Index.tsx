import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { ThreadForm } from '@/components/ThreadForm';
import { ProgressBar } from '@/components/ProgressBar';
import { DomainKeywordModal } from '@/components/DomainKeywordModal';
import { WebQueryModal } from '@/components/WebQueryModal';
import { ThreadDetails } from '@/components/ThreadDetails';
import { Thread, DomainsKeywords, ProgressMessage, Worklet } from '@/types/thread';
import { Skeleton } from '@/components/ui/skeleton';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { API_URL } from '@/config';

const Index = () => {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const location = useLocation();
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);
  const [worklets, setWorklets] = useState<Worklet[]>([]);
  // Stores to preserve per-thread progress & worklets when user navigates away
  const [progressStore, setProgressStore] = useState<Record<string, ProgressMessage[]>>({});
  const [workletsStore, setWorkletsStore] = useState<Record<string, Worklet[]>>({});
  const [subscribedThreads, setSubscribedThreads] = useState<Set<string>>(new Set());
  
  const [domainKeywordModal, setDomainKeywordModal] = useState<{
    open: boolean;
    data: DomainsKeywords | null;
  }>({ open: false, data: null });
  
  const [webQueryModal, setWebQueryModal] = useState<{
    open: boolean;
    queries: string[];
  }>({ open: false, queries: [] });

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    if (!threadId) return;
    // If we already have a selectedThread that matches and is local optimistic, skip fetching
    if (selectedThread && selectedThread.thread_id === threadId && selectedThread.local) {
      return;
    }
    fetchThread(threadId);
  }, [threadId]);

  // Ensure that navigating directly to /new (e.g., typing URL or page refresh) shows the form
  useEffect(() => {
    if (location.pathname === '/new') {
      // Mirror the behavior of clicking the New Thread button
      if (!showForm) setShowForm(true);
      if (selectedThread) setSelectedThread(null);
    } else {
      // Leaving /new should hide the form unless explicitly re-opened
      if (showForm && location.pathname !== '/new') {
        setShowForm(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const fetchThreads = async () => {
    try {
      const response = await fetch(`${API_URL}/thread/all`);
      const data = await response.json();
      const fetched: Thread[] = data.threads || [];
      // Sort descending by created_at (most recent first). Guard against invalid dates.
      const sorted = [...fetched].sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime; // descending
      });
      setThreads(sorted);
    } catch (error) {
      console.error('Error fetching threads:', error);
      toast.error('Failed to fetch threads');
    }
  };

  const fetchThread = async (id: string) => {
    try {
      setThreadLoading(true);
      const response = await fetch(`${API_URL}/thread/${id}`);
      const data = await response.json();
      setSelectedThread(data);

      if (!data.generated) {
        setupSocketListeners(id);
        // hydrate previous progress/worklets if they exist in store
        setProgressMessages(progressStore[id] || []);
        setWorklets(workletsStore[id] || []);
      } else {
        if (data.worklets && data.worklets.length > 0) {
          setWorkletsStore(prev => ({ ...prev, [id]: data.worklets }));
          setWorklets(data.worklets);
        } else {
          // use any stored worklets if available
          setWorklets(workletsStore[id] || []);
        }
        // also restore any stored progress (may be empty)
        setProgressMessages(progressStore[id] || []);
      }
    } catch (error) {
      console.error('Error fetching thread:', error);
      toast.error('Failed to fetch thread');
    }
    finally {
      setThreadLoading(false);
    }
  };

  const setupSocketListeners = (id: string) => {
    // Avoid duplicate subscriptions
    if (subscribedThreads.has(id)) return;
    setSubscribedThreads(prev => new Set(prev).add(id));

    const socket = getSocket();

    socket.on(`${id}/status_update`, (data: { message: string }) => {
      const timestamp = Date.now();
      console.log(`[${new Date(timestamp).toISOString()}] Progress:`, data.message);
      setProgressStore(prev => {
        const existing = prev[id] || [];
        const updated = [...existing, { message: data.message, timestamp }];
        return { ...prev, [id]: updated };
      });
      // Update visible progress immediately if this thread is currently selected (route param may lag)
      setProgressMessages(current => {
        // If we are already displaying the latest message sequence, skip duplicate set
        if (selectedThread?.thread_id === id) {
          // Avoid recreating array if nothing changed
          if (current.length && current[current.length - 1].timestamp === timestamp) return current;
          return [...current, { message: data.message, timestamp }];
        }
        return current;
      });
    });

    socket.on(`${id}/topic_approval`, (data: DomainsKeywords) => {
      console.log('Received topic approval request:', data);
      setDomainKeywordModal({ open: true, data });
    });

    socket.on(`${id}/web_approval`, (data: { queries: string[] }) => {
      setWebQueryModal({ open: true, queries: data.queries });
    });

    socket.on(`${id}/file_generated`, (data: { worklet: Worklet }) => {
      setWorkletsStore(prev => {
        const existing = prev[id] || [];
        const updated = [...existing, data.worklet];
        if (threadId === id) setWorklets(updated);
        return { ...prev, [id]: updated };
      });
    });
  };

  const handleNewThread = () => {
    // Navigate to /new to reflect new thread creation intent
    if (location.pathname !== '/new') {
      navigate('/new', { replace: false });
    }
    setShowForm(true);
    setSelectedThread(null);
    setProgressMessages([]);
    setWorklets([]);
  };

  const handleStartGenerating = () => {
    if (location.pathname !== '/new') {
      navigate('/new');
    }
    setShowForm(true);
  };

  const handleGenerate = async (formData: any) => {
    // Preserve form data in case of failure
    const previousFormData = { ...formData };
    const newThreadId = crypto.randomUUID();

    // Optimistically create a local thread representation
    const optimisticThread = {
      thread_id: newThreadId,
      thread_name: formData.thread_name,
      custom_prompt: formData.custom_prompt,
      links: formData.links,
      files: formData.files,
      count: formData.count,
      generated: false,
      created_at: new Date().toISOString(),
  worklets: [] as Worklet[],
      local: true,
    };

    setSelectedThread(optimisticThread);
    // Optimistically insert at top of sidebar list
    setThreads(prev => {
      const filtered = prev.filter(t => t.thread_id !== newThreadId);
      return [optimisticThread as Thread, ...filtered];
    });
    setShowForm(false);
    setProgressMessages([]);
    setWorklets([]);
    setProgressStore(prev => ({ ...prev, [newThreadId]: [] }));
    setWorkletsStore(prev => ({ ...prev, [newThreadId]: [] }));

    // Navigate to the new thread URL
    navigate(`/${newThreadId}`);

    // Start listening for updates BEFORE sending request
    setupSocketListeners(newThreadId);

    const body = new FormData();
    body.append('thread_id', newThreadId);
    body.append('thread_name', formData.thread_name);
    body.append('custom_prompt', formData.custom_prompt);
    body.append('count', formData.count.toString());
    body.append('links', JSON.stringify(formData.links));
    formData.files.forEach((file: File) => body.append('files', file));

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status ${response.status}`);
      }

  const data = await response.json();
  setWorklets(data.worklets || []);
      // Mark thread as generated & not local anymore so the progress bar disappears
      setSelectedThread(prev => prev ? { 
        ...prev,
        local: false,
        generated: true,
        worklets: data.worklets || prev.worklets
      } : prev);
      if (data.worklets) {
        setWorkletsStore(prev => ({ ...prev, [newThreadId]: data.worklets }));
      }
      setProgressMessages(prev => [
        ...prev,
        { message: 'Worklets generated successfully', timestamp: Date.now() },
      ]);
      fetchThreads();
      toast.success('Worklets generated successfully');
    } catch (error) {
      console.error('Error generating worklets:', error);
      toast.error('Failed to generate worklets');

      // Revert to /new with previously entered form data preserved in form component state
      // We store temporary state to allow the form to repopulate.
      // Approach: pass state via navigation so ThreadForm can potentially use it (would require ThreadForm changes if we want auto-fill).
      navigate('/new', { state: { previousFormData } });
      setShowForm(true);
      setSelectedThread(null);
      setProgressMessages([]);
      setWorklets([]);
    }
  };

  const handleSelectThread = (id: string) => {
    // If the user clicks the already selected thread, do nothing
    if (id === threadId) return;
    // Persist current thread's progress/worklets before switching
    if (selectedThread) {
      setProgressStore(prev => ({ ...prev, [selectedThread.thread_id]: progressMessages }));
      setWorkletsStore(prev => ({ ...prev, [selectedThread.thread_id]: worklets }));
    }
    setSelectedThread(null);
    setThreadLoading(true);
    navigate(`/${id}`);
  };

  const handleHeaderClick = () => {
    // Return to welcome screen
    navigate('/');
    setShowForm(false);
    setSelectedThread(null);
    setProgressMessages([]);
    setWorklets([]);
  };

  const handleDomainKeywordSubmit = (data: DomainsKeywords) => {
    if (!threadId) return;
    
    const socket = getSocket();
    socket.emit(`${threadId}/topic_response`, data);
    setDomainKeywordModal({ open: false, data: null });
  };

  const handleWebQuerySubmit = (queries: string[]) => {
    if (!threadId) return;
    
    const socket = getSocket();
    socket.emit(`${threadId}/web_response`, { queries });
    setWebQueryModal({ open: false, queries: [] });
  };

  // Hydrate progress messages if we navigated (threadId changed) and we already have stored progress
  useEffect(() => {
    if (threadId && progressStore[threadId] && progressStore[threadId].length > 0) {
      // Only hydrate if current list is empty or behind
      if (progressMessages.length < progressStore[threadId].length) {
        setProgressMessages(progressStore[threadId]);
      }
    }
  }, [threadId, progressStore]);

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        threads={threads}
        onNewThread={handleNewThread}
        onSelectThread={handleSelectThread}
        selectedThreadId={threadId || null}
      />
      
      <main className="flex-1 overflow-auto">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="p-6">
            <button
              type="button"
              onClick={handleHeaderClick}
              className="text-left focus:outline-none"
            >
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Worklet Generator Agent
              </h1>
            </button>
          </div>
        </header>

        <div className="p-6">
          {/* Show welcome screen only on root path ("/") with no thread selected and not in /new */}
          {!showForm && !selectedThread && location.pathname === '/' && (
            <WelcomeScreen onStartGenerating={handleStartGenerating} />
          )}
          
          {/* Show form when /new route is active and no thread selected */}
          {showForm && !selectedThread && location.pathname === '/new' && (
            <ThreadForm onGenerate={handleGenerate} />
          )}
          
          {threadLoading && (
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          )}
          {!threadLoading && selectedThread && (
            <>
              {!selectedThread.generated && (
                <ProgressBar messages={progressMessages} />
              )}
              <ThreadDetails
                thread={selectedThread}
                worklets={worklets}
              />
            </>
          )}
        </div>
      </main>

      {domainKeywordModal.data && (
        <DomainKeywordModal
          open={domainKeywordModal.open}
          data={domainKeywordModal.data}
          onSubmit={handleDomainKeywordSubmit}
        />
      )}

      <WebQueryModal
        open={webQueryModal.open}
        queries={webQueryModal.queries}
        onSubmit={handleWebQuerySubmit}
      />
    </div>
  );
};

export default Index;

// Lightweight card skeleton for loading state
const CardSkeleton = () => (
  <div className="p-6 border border-border rounded-lg bg-card space-y-4 animate-pulse">
    <Skeleton className="h-6 w-1/3" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <div className="grid grid-cols-2 gap-2 pt-2">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  </div>
);
