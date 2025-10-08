import { Download, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Thread } from '@/types/thread';

interface ThreadDetailsProps {
  thread: Thread;
  worklets: string[];
}

export const ThreadDetails = ({ thread, worklets }: ThreadDetailsProps) => {
  console.log('ThreadDetails rendered with thread:', thread);
  return (
    <div className="space-y-6 p-6">
      <Card className="p-6 bg-card border-border space-y-4">
        <h3 className="text-xl font-semibold text-foreground mb-4">Thread Details</h3>
        
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Thread ID</p>
            <p className="text-foreground font-mono">{thread.thread_id}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Thread Name</p>
            <p className="text-foreground">{thread.thread_name}</p>
          </div>

          {thread.custom_prompt && (
            <div>
              <p className="text-sm text-muted-foreground">Custom Prompt</p>
              <p className="text-foreground">{thread.custom_prompt}</p>
            </div>
          )}

          {thread.links && thread.links.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Links</p>
              <div className="space-y-1">
                {thread.links.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline block"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {thread.files && thread.files.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Uploaded Files</p>
              <div className="space-y-2">
                {thread.files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Count</p>
            <p className="text-foreground">{thread.count}</p>
          </div>
        </div>
      </Card>

      {worklets.length > 0 && (
        <Card className="p-6 bg-card border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground">Generated Files</h3>
            <Button
              className="gradient-accent hover:opacity-90 transition-smooth"
            >
              <Download className="h-4 w-4 mr-2" />
              Download All
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {worklets.map((file, index) => (
              <Button
                key={index}
                variant="outline"
                className="border-border hover:border-primary transition-smooth justify-start"
              >
                <FileIcon className="h-4 w-4 mr-2" />
                {file}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
