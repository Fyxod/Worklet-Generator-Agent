import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { ThreadForm } from '@/components/ThreadForm';
import { ProgressBar } from '@/components/ProgressBar';
import { DomainKeywordModal } from '@/components/DomainKeywordModal';
import { WebQueryModal } from '@/components/WebQueryModal';
import { ThreadDetails } from '@/components/ThreadDetails';
import { Thread, DomainsKeywords, ProgressMessage } from '@/types/thread';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { API_URL } from '@/config';

const Index = () => {
  const navigate = useNavigate();
  const { threadId } = useParams();
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);
  
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
    if (threadId) {
      fetchThread(threadId);
    }
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
        setGeneratedFiles(data.generated_files || []);
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

    socket.on(`${id}/file_generated`, (data: { filename: string }) => {
      setGeneratedFiles(prev => [...prev, data.filename]);
    });
  };

  const handleNewThread = () => {
    setShowForm(true);
    setSelectedThread(null);
  };

  const handleStartGenerating = () => {
    setShowForm(true);
  };

  const handleGenerate = async (formData: any) => {
    const newThreadId = crypto.randomUUID();
    navigate(`/${newThreadId}`);
    
    setProgressMessages([]);
    setGeneratedFiles([]);
    setupSocketListeners(newThreadId);

    const body = new FormData();
    body.append("thread_id", newThreadId);
    body.append("thread_name", formData.thread_name);
    body.append("custom_prompt", formData.custom_prompt);
    body.append("count", formData.count.toString());
    body.append("links", JSON.stringify(formData.links));
    
    formData.files.forEach((file: File) => body.append("files", file));


  try {
    const response = await fetch(`${API_URL}/generate`, {
      method: "POST",
      body,
    });

      if (response.ok) {
        const data = await response.json();
        setGeneratedFiles(data.generated_files || []);
        setProgressMessages(prev => [...prev, { 
          message: 'Worklets generated successfully', 
          timestamp: Date.now() 
        }]);
        fetchThreads();
        toast.success('Worklets generated successfully');
      }
    } catch (error) {
      console.error('Error generating worklets:', error);
      toast.error('Failed to generate worklets');
    }
  };

  const handleSelectThread = (id: string) => {
    navigate(`/${id}`);
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Worklet Generator Agent
            </h1>
          </div>
        </header>

        <div className="p-6">
          {!showForm && !selectedThread && (
            <WelcomeScreen onStartGenerating={handleStartGenerating} />
          )}
          
          {showForm && !selectedThread && (
            <ThreadForm onGenerate={handleGenerate} />
          )}
          
          {selectedThread && (
            <>
              {!selectedThread.generated && (
                <ProgressBar messages={progressMessages} />
              )}
              <ThreadDetails
                thread={selectedThread}
                generatedFiles={generatedFiles}
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
