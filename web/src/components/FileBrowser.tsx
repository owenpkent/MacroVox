import { useState, useEffect } from 'react'
import { Folder, File, ChevronLeft, Loader2, Github, LogIn } from 'lucide-react'

interface RepoFile {
  name: string
  path: string
  type: 'file' | 'dir'
}

interface FileBrowserProps {
  isOpen: boolean
  onClose: () => void
  currentRepo: { owner: string; repo: string } | null
  isLoading: boolean
  isAuthenticated: boolean
  onLogin: () => void
  onSelectRepo: (fullName: string) => void
  onSelectFile: (path: string) => void
  listRepos: () => Promise<Array<{ full_name: string; private: boolean }>>
  listFiles: (path?: string) => Promise<RepoFile[]>
}

export function FileBrowser({
  isOpen,
  onClose,
  currentRepo,
  isLoading,
  isAuthenticated,
  onLogin,
  onSelectRepo,
  onSelectFile,
  listRepos,
  listFiles
}: FileBrowserProps) {
  const [repos, setRepos] = useState<Array<{ full_name: string; private: boolean }>>([])
  const [files, setFiles] = useState<RepoFile[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [view, setView] = useState<'repos' | 'files'>('repos')

  useEffect(() => {
    if (isOpen && view === 'repos' && repos.length === 0 && isAuthenticated) {
      listRepos().then(setRepos)
    }
  }, [isOpen, view, repos.length, listRepos, isAuthenticated])

  useEffect(() => {
    if (currentRepo && view === 'files') {
      listFiles(currentPath).then(setFiles)
    }
  }, [currentRepo, currentPath, view, listFiles])

  const handleSelectRepo = (fullName: string) => {
    onSelectRepo(fullName)
    setCurrentPath('')
    setView('files')
  }

  const handleSelectItem = (item: RepoFile) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path)
    } else {
      onSelectFile(item.path)
      onClose()
    }
  }

  const handleBack = () => {
    if (currentPath) {
      const parts = currentPath.split('/')
      parts.pop()
      setCurrentPath(parts.join('/'))
    } else {
      setView('repos')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-slate-800 w-full sm:w-96 max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            {(view === 'files' || currentPath) && (
              <button onClick={handleBack} className="p-1 hover:bg-slate-700 rounded">
                <ChevronLeft size={20} />
              </button>
            )}
            <span className="font-medium">
              {view === 'repos' ? 'Select Repository' : currentRepo?.repo}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Path breadcrumb */}
        {view === 'files' && currentPath && (
          <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-700 truncate">
            /{currentPath}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : view === 'repos' ? (
            !isAuthenticated ? (
              <div className="px-4 py-12 text-center">
                <Github size={48} className="mx-auto text-slate-500 mb-4" />
                <p className="text-slate-400 mb-4">Sign in to access your GitHub repositories</p>
                <button
                  onClick={onLogin}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <LogIn size={18} />
                  <span>Sign in with GitHub</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {repos.map((repo) => (
                  <button
                    key={repo.full_name}
                    onClick={() => handleSelectRepo(repo.full_name)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 active:bg-slate-600 text-left"
                  >
                    <Github size={18} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{repo.full_name}</span>
                    {repo.private && (
                      <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">private</span>
                    )}
                  </button>
                ))}
                {repos.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-500">
                    No repositories found
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="divide-y divide-slate-700">
              {files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleSelectItem(file)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 active:bg-slate-600 text-left"
                >
                  {file.type === 'dir' ? (
                    <Folder size={18} className="text-blue-400 flex-shrink-0" />
                  ) : (
                    <File size={18} className="text-slate-400 flex-shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </button>
              ))}
              {files.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">
                  Empty directory
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
