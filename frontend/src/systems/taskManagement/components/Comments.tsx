// Comments - Component for comments display

import React from 'react'
import { FiMessageSquare } from 'react-icons/fi'

interface Comment {
  _id?: string
  commenter: string
  comment: string
  createdAt: string
  updatedAt: string
}

interface CommentsProps {
  comments: Comment[]
  formatDate: (date: string) => string
}

const Comments: React.FC<CommentsProps> = ({ comments, formatDate }) => {
  // Sort comments by createdAt in descending order (newest first)
  const sortedComments = [...(comments || [])].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Comments ({comments?.length || 0})</h3>
      <div className="space-y-4 ">
        {sortedComments.map((comment: Comment) => (
<div key={comment._id} className="bg-white border border-gray-200 rounded-lg p-3 w-full">
  <p className="text-sm text-gray-900 break-words whitespace-pre-wrap">
    {comment.comment}
  </p>
  <p className="text-xs text-gray-500 mt-1">
    {formatDate(comment.createdAt)}
  </p>
</div>
        ))}
        {(!comments || comments.length === 0) && (
          <div className="text-center py-6 text-gray-500">
            <FiMessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Comments