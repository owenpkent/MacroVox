import { useState, useCallback } from 'react'

interface RepoFile {
  name: string
  path: string
  type: 'file' | 'dir'
  sha?: string
}

interface FileContent {
  content: string
  sha: string
  path: string
}

interface UseGitHubOptions {
  onError: (error: string) => void
}

export function useGitHub({ onError }: UseGitHubOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentRepo, setCurrentRepo] = useState<{ owner: string; repo: string } | null>(null)

  const getToken = useCallback(() => {
    const token = localStorage.getItem('github_token')
    if (!token) {
      const userToken = prompt('Enter your GitHub Personal Access Token (with repo scope):')
      if (!userToken) return null
      localStorage.setItem('github_token', userToken)
      return userToken
    }
    return token
  }, [])

  const fetchApi = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = getToken()
    if (!token) throw new Error('GitHub token required')

    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'GitHub API error')
    }

    return response.json()
  }, [getToken])

  const listRepos = useCallback(async (): Promise<Array<{ full_name: string; private: boolean }>> => {
    setIsLoading(true)
    try {
      const repos = await fetchApi('/user/repos?sort=updated&per_page=20')
      return repos.map((r: any) => ({ full_name: r.full_name, private: r.private }))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to list repos')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [fetchApi, onError])

  const selectRepo = useCallback((fullName: string) => {
    const [owner, repo] = fullName.split('/')
    setCurrentRepo({ owner, repo })
  }, [])

  const listFiles = useCallback(async (path: string = ''): Promise<RepoFile[]> => {
    if (!currentRepo) return []
    setIsLoading(true)
    try {
      const contents = await fetchApi(`/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`)
      if (Array.isArray(contents)) {
        return contents.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type === 'dir' ? 'dir' : 'file',
          sha: item.sha
        }))
      }
      return []
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to list files')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [currentRepo, fetchApi, onError])

  const loadFile = useCallback(async (path: string): Promise<FileContent | null> => {
    if (!currentRepo) return null
    setIsLoading(true)
    try {
      const file = await fetchApi(`/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`)
      const content = atob(file.content.replace(/\n/g, ''))
      return {
        content,
        sha: file.sha,
        path: file.path
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load file')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [currentRepo, fetchApi, onError])

  const saveFile = useCallback(async (
    path: string, 
    content: string, 
    sha: string | null,
    message: string = 'Update via MacroVox Mobile'
  ): Promise<boolean> => {
    if (!currentRepo) return false
    setIsLoading(true)
    try {
      await fetchApi(`/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: btoa(content),
          sha: sha || undefined
        })
      })
      return true
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to save file')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [currentRepo, fetchApi, onError])

  return {
    isLoading,
    currentRepo,
    listRepos,
    selectRepo,
    listFiles,
    loadFile,
    saveFile
  }
}
