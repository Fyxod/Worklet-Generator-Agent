import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, PROJECT_NAME } from '../../config';
import { ApiError, requestJson } from '@/lib/http';
import { Cluster } from '@/types/cluster';

const NEW_CLUSTER_BOX_ID = '__creating__';

const ClustersPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchClusters();
  }, []);

  useEffect(() => {
    if ((creating && !editingId) || editingId) {
      const timeout = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [creating, editingId]);

  const hasNoClusters = useMemo(() => !loading && clusters.length === 0 && !creating, [loading, clusters.length, creating]);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const data = await requestJson<{ clusters: Cluster[] }>(`${API_URL}/clusters`);
      setClusters(data.clusters || []);
    } catch (error) {
      console.error('Error fetching clusters:', error);
      const message = error instanceof ApiError ? error.message : 'Failed to load clusters';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreating = () => {
    setCreating(true);
    setNewName('');
    setEditingId(null);
  };

  const resetCreatingState = () => {
    setCreating(false);
    setNewName('');
  };

  const handleCreateCluster = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('Please enter a cluster name');
      return;
    }
    setBusyId(NEW_CLUSTER_BOX_ID);
    try {
      const created = await requestJson<Cluster>(`${API_URL}/clusters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      setClusters((prev) => [created, ...prev]);
      toast.success('Cluster created');
      resetCreatingState();
      navigate(`/cluster/${created.cluster_id}`);
    } catch (error) {
      console.error('Error creating cluster:', error);
      const message = error instanceof ApiError ? error.message : 'Failed to create cluster';
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRenameClick = (cluster: Cluster) => {
    setEditingId(cluster.cluster_id);
    setEditingName(cluster.name);
    setCreating(false);
    setConfirmDeleteId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error('Please enter a cluster name');
      return;
    }
    setBusyId(editingId);
    try {
      const updated = await requestJson<Cluster>(`${API_URL}/clusters/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      setClusters((prev) => prev.map((cluster) => (cluster.cluster_id === updated.cluster_id ? updated : cluster)));
      toast.success('Cluster renamed');
      cancelEditing();
    } catch (error) {
      console.error('Error renaming cluster:', error);
      const message = error instanceof ApiError ? error.message : 'Failed to rename cluster';
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteCluster = async (clusterId: string) => {
    setBusyId(clusterId);
    try {
      await requestJson(`${API_URL}/clusters/${clusterId}`, { method: 'DELETE' });
      setClusters((prev) => prev.filter((cluster) => cluster.cluster_id !== clusterId));
      toast.success('Cluster deleted');
      if (confirmDeleteId === clusterId) setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error deleting cluster:', error);
      const message = error instanceof ApiError ? error.message : 'Failed to delete cluster';
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{PROJECT_NAME}</h1>
            <p className="text-muted-foreground mt-1">Choose or create a cluster to start working with threads.</p>
          </div>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="hidden sm:inline-flex"
                    onClick={handleStartCreating}
                    disabled={creating && !hasNoClusters}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add cluster
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add a new cluster</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStartCreating}
              className="sm:hidden"
              disabled={creating && !hasNoClusters}
              aria-label="Add cluster"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {hasNoClusters && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <p className="text-lg text-muted-foreground">No clusters yet. Create your first cluster to get started.</p>
            <Button
              size="lg"
              className="gradient-primary shadow-glow px-10 py-6 text-lg"
              onClick={handleStartCreating}
            >
              <Plus className="mr-2 h-5 w-5" />
              Add cluster
            </Button>
          </div>
        )}

        <div className="grid gap-8 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {creating && (
            <Card className="relative h-80 w-60 mx-auto flex flex-col justify-between border-dashed border-2 border-primary/60 bg-card">
              <form onSubmit={handleCreateCluster} className="flex flex-1 flex-col">
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground">New cluster</h2>
                  <Input
                    ref={inputRef}
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Cluster name"
                    className="bg-input border-border"
                    disabled={busyId === NEW_CLUSTER_BOX_ID}
                  />
                </div>
                <div className="p-6 pt-0 space-y-3">
                  <Button
                    type="submit"
                    className="w-full gradient-primary"
                    disabled={busyId === NEW_CLUSTER_BOX_ID}
                  >
                    Create cluster
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={resetCreatingState}
                    disabled={busyId === NEW_CLUSTER_BOX_ID}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {clusters.map((cluster) => {
            const isEditing = editingId === cluster.cluster_id;
            return (
              <Card
                key={cluster.cluster_id}
                className="relative h-80 w-60 mx-auto flex flex-col items-center justify-center border-border bg-card hover:border-primary transition-smooth"
              >
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                    onClick={() => handleRenameClick(cluster)}
                    aria-label="Rename cluster"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <AlertDialog open={confirmDeleteId === cluster.cluster_id} onOpenChange={(open) => setConfirmDeleteId(open ? cluster.cluster_id : null)}>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth"
                        onClick={() => setConfirmDeleteId(cluster.cluster_id)}
                        aria-label="Delete cluster"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete cluster</AlertDialogTitle>
                        <AlertDialogDescription>
                          Deleting this cluster will remove all threads associated with it. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDeleteCluster(cluster.cluster_id)}
                          disabled={busyId === cluster.cluster_id}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {isEditing ? (
                  <form onSubmit={handleRenameSubmit} className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center w-full">
                    <Input
                      ref={inputRef}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className="bg-input border-border"
                      disabled={busyId === cluster.cluster_id}
                    />
                    <div className="w-full space-y-3">
                      <Button type="submit" className="w-full" disabled={busyId === cluster.cluster_id}>Save</Button>
                      <Button type="button" variant="ghost" className="w-full" onClick={cancelEditing} disabled={busyId === cluster.cluster_id}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="flex-1 flex flex-col items-center justify-center px-6 text-center"
                    onClick={() => navigate(`/cluster/${cluster.cluster_id}`)}
                  >
                    <h2 className="text-xl font-semibold text-foreground break-words">{cluster.name}</h2>
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default ClustersPage;
