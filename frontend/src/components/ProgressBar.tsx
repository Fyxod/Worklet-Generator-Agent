import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ProgressMessage } from '@/types/thread';

interface ProgressBarProps {
  messages: ProgressMessage[];
}

export const ProgressBar = ({ messages }: ProgressBarProps) => {
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [messageQueue, setMessageQueue] = useState<ProgressMessage[]>([]);

  useEffect(() => {
    if (messages.length > 0) {
      setMessageQueue(prev => [...prev, ...messages]);
    }
  }, [messages]);

  useEffect(() => {
    if (messageQueue.length > 0 && !currentMessage) {
      const nextMessage = messageQueue[0];
      setCurrentMessage(nextMessage.message);
      
      setTimeout(() => {
        setCurrentMessage('');
        setMessageQueue(prev => prev.slice(1));
      }, 1000);
    }
  }, [messageQueue, currentMessage]);

  if (!currentMessage && messageQueue.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-lg p-4 shadow-glow animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{currentMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
