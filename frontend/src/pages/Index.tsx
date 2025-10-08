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
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { API_URL } from '@/config';

const Index = () => {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const location = useLocation();
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);
  const [worklets, setWorklets] = useState<Worklet[]>([]);
  
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

  const fetchThreads = async () => {
    try {
      const response = await fetch(`${API_URL}/thread/all`);
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Error fetching threads:', error);
      toast.error('Failed to fetch threads');
    }
  };

  const fetchThread = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/thread/${id}`);
      const data = await response.json();
      setSelectedThread(data);
      
      if (!data.generated) {
        setupSocketListeners(id);
      } else {
  setWorklets(data.worklets || []);
      }
    } catch (error) {
      console.error('Error fetching thread:', error);
      toast.error('Failed to fetch thread');
    }
  };

  const setupSocketListeners = (id: string) => {
    const socket = getSocket();

    socket.on(`${id}/status_update`, (data: { message: string }) => {
      const timestamp = Date.now();
      console.log(`[${new Date(timestamp).toISOString()}] Progress:`, data.message);
      setProgressMessages(prev => [...prev, { message: data.message, timestamp }]);
    });

    socket.on(`${id}/topic_approval`, (data: DomainsKeywords) => {
      setDomainKeywordModal({ open: true, data });
    });

    socket.on(`${id}/web_approval`, (data: { queries: string[] }) => {
      setWebQueryModal({ open: true, queries: data.queries });
    });

    socket.on(`${id}/file_generated`, (data: { worklet: Worklet }) => {
      // Backend now should emit the full worklet object
      setWorklets(prev => [...prev, data.worklet]);
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
    setShowForm(false);
    setProgressMessages([]);
    setWorklets([]);

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
          
          {selectedThread && (
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
