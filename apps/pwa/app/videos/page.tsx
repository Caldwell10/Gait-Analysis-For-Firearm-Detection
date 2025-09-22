'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VideosPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/avi', 'video/x-msvideo', 'video/quicktime']
      if (!allowedTypes.includes(selectedFile.type)) {
        setMessage('Please select a valid video file (.mp4, .avi, .mov)')
        return
      }

      // Validate file size (100MB max)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setMessage('File size must be less than 100MB')
        return
      }

      setFile(selectedFile)
      setMessage('')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first')
      return
    }

    setUploading(true)
    setMessage('Starting upload...')
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setMessage('Uploading file...')
      setUploadProgress(25)

      const response = await fetch('http://localhost:8000/api/videos/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      setUploadProgress(75)

      if (response.ok) {
        setUploadProgress(100)
        const result = await response.json()
        setMessage(`✅ Upload successful! Video ID: ${result.video_id}`)
        setFile(null)
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        const error = await response.json()
        setMessage(`❌ Upload failed: ${error.detail || 'Unknown error'}`)
      }
    } catch (error) {
      setMessage(`❌ Upload failed: ${error instanceof Error ? error.message : 'Network error'}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6">Upload Thermal Video</h1>

        <div className="space-y-6">
          <div>
            <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
              Select Video File
            </label>
            <input
              id="file-input"
              type="file"
              accept=".mp4,.avi,.mov,video/mp4,video/avi,video/quicktime"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: MP4, AVI, MOV (max 100MB)
            </p>
          </div>

          {file && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900">Selected File:</h3>
              <p className="text-sm text-gray-600">Name: {file.name}</p>
              <p className="text-sm text-gray-600">Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <p className="text-sm text-gray-600">Type: {file.type}</p>
            </div>
          )}

          {uploading && (
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-blue-800">{message}</span>
              </div>
              {uploadProgress > 0 && (
                <div className="mt-2">
                  <div className="bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{width: `${uploadProgress}%`}}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!uploading && message && (
            <div className={`p-4 rounded-md ${message.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t">
          <h2 className="text-lg font-semibold mb-4">API Testing</h2>
          <p className="text-sm text-gray-600 mb-2">
            You can also test the API directly at:
          </p>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            http://localhost:8000/docs
          </a>
        </div>
      </div>
    </div>
  )
}