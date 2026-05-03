// useTaskRealtime - Custom hook for task real-time communication
// Handles socket events for tasks, subtasks, and notifications

import { useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'
import type { Task, TaskStatus } from '../services/taskService'

export interface TaskRealtimeCallbacks {
  onTaskStatusUpdated?: (data: { taskId: string; status: TaskStatus; updatedBy: any; timestamp: Date }) => void
  onSubtaskUpdated?: (data: { taskId: string; subtaskId: string; updates: any; updatedBy: any; timestamp: Date }) => void
  onCommentAdded?: (data: { taskId: string; comment: any; commenter: any; timestamp: Date }) => void
  onTaskDeadlineNotification?: (data: { task: Task; notification: any; type: string }) => void
  onTaskUpdated?: (data: { task: Task; action: string; newStatus?: TaskStatus }) => void
  onTaskError?: (data: { message: string }) => void
}

export const useTaskRealtime = (
  callbacks: TaskRealtimeCallbacks = {},
  taskId?: string // Optional: listen to specific task room
) => {
  const { socket, isConnected, on, off } = useSocket()

  // Join task room when taskId is provided
  useEffect(() => {
    if (!socket || !isConnected || !taskId) return

    socket.emit('join_task_room', taskId)

    return () => {
      if (socket && taskId) {
        socket.emit('leave_task_room', taskId)
      }
    }
  }, [socket, isConnected, taskId])

  // Set up event listeners
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleTaskStatusUpdated = (data: any) => {
      callbacks.onTaskStatusUpdated?.(data)
    }

    const handleSubtaskUpdated = (data: any) => {
      callbacks.onSubtaskUpdated?.(data)
    }

    const handleCommentAdded = (data: any) => {
      callbacks.onCommentAdded?.(data)
    }

    const handleTaskDeadlineNotification = (data: any) => {
      callbacks.onTaskDeadlineNotification?.(data)
    }

    const handleTaskUpdated = (data: any) => {
      callbacks.onTaskUpdated?.(data)
    }

    const handleTaskError = (data: any) => {
      callbacks.onTaskError?.(data)
    }

    // Register listeners
    socket.on('task_status_updated', handleTaskStatusUpdated)
    socket.on('subtask_updated', handleSubtaskUpdated)
    socket.on('comment_added', handleCommentAdded)
    socket.on('task_deadline_notification', handleTaskDeadlineNotification)
    socket.on('task_updated', handleTaskUpdated)
    socket.on('task_error', handleTaskError)

    // Cleanup
    return () => {
      socket.off('task_status_updated', handleTaskStatusUpdated)
      socket.off('subtask_updated', handleSubtaskUpdated)
      socket.off('comment_added', handleCommentAdded)
      socket.off('task_deadline_notification', handleTaskDeadlineNotification)
      socket.off('task_updated', handleTaskUpdated)
      socket.off('task_error', handleTaskError)
    }
  }, [socket, isConnected, callbacks])

  // Emit functions for sending events to server
  const emitUpdateTaskStatus = useCallback((taskId: string, status: TaskStatus, userId: string) => {
    if (socket && isConnected) {
      socket.emit('update_task_status', { taskId, status, userId })
    }
  }, [socket, isConnected])

  const emitUpdateSubtask = useCallback((taskId: string, subtaskId: string, updates: any, userId: string) => {
    if (socket && isConnected) {
      socket.emit('update_subtask', { taskId, subtaskId, updates, userId })
    }
  }, [socket, isConnected])

  const emitAddComment = useCallback((taskId: string, comment: string, userId: string) => {
    if (socket && isConnected) {
      socket.emit('add_comment', { taskId, comment, userId })
    }
  }, [socket, isConnected])

  const emitScheduleDeadlineReminder = useCallback((taskId: string, reminderTime: string, userId: string) => {
    if (socket && isConnected) {
      socket.emit('schedule_deadline_reminder', { taskId, reminderTime, userId })
    }
  }, [socket, isConnected])

  const emitGetActiveTasks = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('get_active_tasks', { userId })
    }
  }, [socket, isConnected])

  return {
    isConnected,
    emitUpdateTaskStatus,
    emitUpdateSubtask,
    emitAddComment,
    emitScheduleDeadlineReminder,
    emitGetActiveTasks
  }
}

export default useTaskRealtime