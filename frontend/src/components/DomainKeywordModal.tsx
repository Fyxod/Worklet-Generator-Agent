import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DomainsKeywords } from '@/types/thread';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DomainKeywordModalProps {
  open: boolean;
  data: DomainsKeywords;
  onSubmit: (data: DomainsKeywords) => void;
}

export const DomainKeywordModal = ({ open, data, onSubmit }: DomainKeywordModalProps) => {
  const [domains, setDomains] = useState(data.domains);
  const [keywords, setKeywords] = useState(data.keywords);
  const [showCustomDomains, setShowCustomDomains] = useState(false);
  const [showCustomKeywords, setShowCustomKeywords] = useState(false);

  const removeItem = (category: 'domains' | 'keywords', section: string, index: number) => {
    if (category === 'domains') {
      const newDomains = { ...domains };
      (newDomains as any)[section].splice(index, 1);
      setDomains(newDomains);
    } else {
      const newKeywords = { ...keywords };
      (newKeywords as any)[section].splice(index, 1);
      setKeywords(newKeywords);
    }
  };

  const updateItem = (category: 'domains' | 'keywords', section: string, index: number, value: string) => {
    if (category === 'domains') {
      const newDomains = { ...domains };
      (newDomains as any)[section][index] = value;
      setDomains(newDomains);
    } else {
      const newKeywords = { ...keywords };
      (newKeywords as any)[section][index] = value;
      setKeywords(newKeywords);
    }
  };

  const addCustomItem = (category: 'domains' | 'keywords') => {
    if (category === 'domains') {
      setShowCustomDomains(true);
      if (!domains.custom) {
        setDomains({ ...domains, custom: [''] });
      } else {
        setDomains({ ...domains, custom: [...domains.custom, ''] });
      }
    } else {
      setShowCustomKeywords(true);
      if (!keywords.custom) {
        setKeywords({ ...keywords, custom: [''] });
      } else {
        setKeywords({ ...keywords, custom: [...keywords.custom, ''] });
      }
    }
  };

  const handleSubmit = () => {
    onSubmit({ domains, keywords });
  };

  const renderSection = (
    title: string,
    items: string[],
    category: 'domains' | 'keywords',
    section: string
  ) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => updateItem(category, section, index, e.target.value)}
              className="bg-input border-border"
            />
            <Button
              type="button"
              onClick={() => removeItem(category, section, index)}
              size="icon"
              variant="ghost"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Domains & Keywords
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="grid grid-cols-2 gap-8">
            {/* Domains Column */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Domains</h3>
                <Button
                  type="button"
                  onClick={() => addCustomItem('domains')}
                  size="sm"
                  variant="outline"
                  className="border-border"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Custom
                </Button>
              </div>
              {renderSection('Worklets', domains.worklet, 'domains', 'worklet_domains')}
              {renderSection('Links', domains.link, 'domains', 'link_domains')}
              {renderSection('Custom Prompt', domains.custom_prompt, 'domains', 'custom_prompt')}
              {showCustomDomains && domains.custom && renderSection('Custom Domains', domains.custom, 'domains', 'custom')}
            </div>

            {/* Keywords Column */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Keywords</h3>
                <Button
                  type="button"
                  onClick={() => addCustomItem('keywords')}
                  size="sm"
                  variant="outline"
                  className="border-border"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Custom
                </Button>
              </div>
              {renderSection('Worklets', keywords.worklet, 'keywords', 'worklet_keywords')}
              {renderSection('Links', keywords.link, 'keywords', 'link_keywords')}
              {renderSection('Custom Prompt', keywords.custom_prompt, 'keywords', 'custom_prompt_keywords')}
              {showCustomKeywords && keywords.custom && renderSection('Custom Keywords', keywords.custom, 'keywords', 'custom_keywords')}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSubmit}
            className="gradient-primary hover:opacity-90 transition-smooth"
          >
            Next
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
