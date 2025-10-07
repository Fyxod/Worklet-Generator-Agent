export interface Thread {
  thread_id: string;
  thread_name: string;
  custom_prompt?: string;
  links?: string[];
  files?: File[];
  count: number;
  generated: boolean;
  created_at: string;
  generated_files?: string[];
}

export interface DomainsKeywords {
  domains: {
    worklet: string[];
    link: string[];
    custom_prompt: string[];
    custom: string[];
  };
  keywords: {
    worklet: string[];
    link: string[];
    custom_prompt: string[];
    custom: string[];
  };
}

export interface ProgressMessage {
  message: string;
  timestamp: number;
}
