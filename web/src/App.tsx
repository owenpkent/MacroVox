import { useState, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { Mic, MicOff, Play, Save, Loader2, Check, X, Bot, Type, LogIn, LogOut } from 'lucide-react'
import { useDeepgram } from './hooks/useDeepgram'
import { useClaude } from './hooks/useClaude'
import { useGitHub } from './hooks/useGitHub'
import { FileBrowser } from './components/FileBrowser'

function App() {
  const [code, setCode] = useState(`// Welcome to MacroVox Mobile
// Tap the mic and speak to generate code

import express from 'express';
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from MacroVox!' });
});

app.listen(3000);
`)
  const [transcript, setTranscript] = useState('')
  const [pendingEdit, setPendingEdit] = useState<{ code: string; explanation: string; line: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'agent' | 'transcribe'>('agent')
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false)
  const [currentFile, setCurrentFile] = useState<{ path: string; sha: string | null }>({ path: 'untitled.ts', sha: null })
  const [isSaving, setIsSaving] = useState(false)
  const editorRef = useRef<any>(null)
  const cursorLineRef = useRef(1)

  const { 
    isLoading: isGitHubLoading,
    isAuthenticated,
    user,
    currentRepo,
    login,
    logout,
    listRepos, 
    selectRepo, 
    listFiles, 
    loadFile, 
    saveFile 
  } = useGitHub({ onError: (err) => setError(err) })

  const handleCodeGenerated = useCallback((edit: { action: string; position?: { line: number }; code: string; explanation: string }) => {
    setPendingEdit({
      code: edit.code,
      explanation: edit.explanation,
      line: edit.position?.line || cursorLineRef.current
    })
  }, [])

  const { isProcessing, generateCode } = useClaude({
    onCodeGenerated: handleCodeGenerated,
    onError: (err) => setError(err)
  })

  const insertTextAtCursor = useCallback((text: string) => {
    if (!editorRef.current) return
    const editor = editorRef.current
    const position = editor.getPosition()
    editor.executeEdits('voice-input', [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      },
      text: text + ' '
    }])
  }, [])

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    setTranscript(text)
    if (isFinal && text.trim()) {
      if (mode === 'agent') {
        generateCode(text, {
          fileContent: code,
          cursorLine: cursorLineRef.current,
          language: 'typescript',
          fileName: 'index.ts'
        })
      } else {
        insertTextAtCursor(text)
        setTranscript('')
      }
    }
  }, [code, generateCode, mode, insertTextAtCursor])

  const { isListening, isConnecting, startListening, stopListening } = useDeepgram({
    onTranscript: handleTranscript
  })

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor
    editor.onDidChangeCursorPosition((e: any) => {
      cursorLineRef.current = e.position.lineNumber
    })
  }

  const acceptEdit = () => {
    if (!pendingEdit) return
    const lines = code.split('\n')
    lines.splice(pendingEdit.line - 1, 0, pendingEdit.code)
    setCode(lines.join('\n'))
    setPendingEdit(null)
    setTranscript('')
  }

  const rejectEdit = () => {
    setPendingEdit(null)
    setTranscript('')
  }

  const handleSelectFile = async (path: string) => {
    const file = await loadFile(path)
    if (file) {
      setCode(file.content)
      setCurrentFile({ path: file.path, sha: file.sha })
    }
  }

  const handleSave = async () => {
    if (!currentRepo) {
      setError('Select a repository first')
      return
    }
    setIsSaving(true)
    const success = await saveFile(currentFile.path, code, currentFile.sha)
    if (success) {
      const file = await loadFile(currentFile.path)
      if (file) setCurrentFile({ path: file.path, sha: file.sha })
    }
    setIsSaving(false)
  }

  const getLanguageFromPath = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
      json: 'json', md: 'markdown', css: 'css', html: 'html', yml: 'yaml', yaml: 'yaml'
    }
    return map[ext || ''] || 'plaintext'
  }

  const toggleMic = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <button 
          onClick={() => setFileBrowserOpen(true)}
          className="flex items-center gap-2 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
        >
          <span className="text-lg font-semibold text-white">MacroVox</span>
          {currentRepo && (
            <span className="text-xs text-slate-400 truncate max-w-[120px]">
              {currentRepo.repo}/{currentFile.path.split('/').pop()}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button 
              onClick={handleSave}
              disabled={isSaving || isGitHubLoading || !currentRepo}
              className="p-2 rounded-lg hover:bg-slate-700 active:bg-slate-600 transition-colors disabled:opacity-50"
              title="Save to GitHub"
            >
              {isSaving ? (
                <Loader2 size={20} className="text-slate-400 animate-spin" />
              ) : (
                <Save size={20} className="text-slate-400" />
              )}
            </button>
          )}
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors"
              title="Sign out"
            >
              {user?.avatar_url && (
                <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
              )}
              <LogOut size={18} className="text-slate-400" />
            </button>
          ) : (
            <button
              onClick={login}
              disabled={isGitHubLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm text-white"
            >
              <LogIn size={16} />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={getLanguageFromPath(currentFile.path)}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12 },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            }
          }}
        />
      </div>

      {/* Transcript / Pending Edit Area */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 min-h-[80px]">
        {error && (
          <div className="text-red-400 text-sm mb-2 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}
        
        {pendingEdit ? (
          <div>
            <div className="text-xs text-green-400 mb-1 uppercase tracking-wide">
              ✨ Generated Code
            </div>
            <div className="text-xs text-slate-400 mb-2">{pendingEdit.explanation}</div>
            <pre className="text-sm text-slate-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-24">
              {pendingEdit.code}
            </pre>
            <div className="flex gap-2 mt-2">
              <button
                onClick={acceptEdit}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white"
              >
                <Check size={16} /> Accept
              </button>
              <button
                onClick={rejectEdit}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 rounded text-sm text-white"
              >
                <X size={16} /> Reject
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
              {isProcessing ? '⚡ Generating...' : isListening ? '🎤 Listening...' : mode === 'agent' ? '🤖 Agent Mode' : '📝 Dictation Mode'}
            </div>
            <div className="text-sm text-slate-300 min-h-[40px]">
              {isProcessing ? (
                <span className="text-blue-400 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Processing with Claude...
                </span>
              ) : transcript || (
                <span className="text-slate-500 italic">
                  Tap mic and speak your intent...
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-around px-4 py-3 bg-slate-900 border-t border-slate-700 safe-area-bottom">
        {/* Mode Toggle */}
        <button 
          onClick={() => setMode(mode === 'agent' ? 'transcribe' : 'agent')}
          className="flex flex-col items-center gap-1 p-2"
        >
          {mode === 'agent' ? (
            <>
              <Bot size={24} className="text-purple-400" />
              <span className="text-xs text-purple-400">Agent</span>
            </>
          ) : (
            <>
              <Type size={24} className="text-blue-400" />
              <span className="text-xs text-blue-400">Dictate</span>
            </>
          )}
        </button>

        {/* Mic Button - Primary Action */}
        <button
          onClick={toggleMic}
          disabled={isConnecting}
          className={`
            flex items-center justify-center w-16 h-16 rounded-full transition-all
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 animate-pulse' 
              : mode === 'agent' 
                ? 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700'
                : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'}
            ${isConnecting ? 'opacity-50' : ''}
            shadow-lg active:scale-95
          `}
        >
          {isConnecting ? (
            <Loader2 size={28} className="text-white animate-spin" />
          ) : isListening ? (
            <MicOff size={28} className="text-white" />
          ) : (
            <Mic size={28} className="text-white" />
          )}
        </button>

        <button className="flex flex-col items-center gap-1 p-2">
          <Play size={24} className="text-slate-400" />
          <span className="text-xs text-slate-500">Run</span>
        </button>
      </div>
    {/* File Browser Modal */}
      <FileBrowser
        isOpen={fileBrowserOpen}
        onClose={() => setFileBrowserOpen(false)}
        currentRepo={currentRepo}
        isLoading={isGitHubLoading}
        isAuthenticated={isAuthenticated}
        onLogin={login}
        onSelectRepo={selectRepo}
        onSelectFile={handleSelectFile}
        listRepos={listRepos}
        listFiles={listFiles}
      />
    </div>
  )
}

export default App
