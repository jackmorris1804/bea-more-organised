import React, { useState, useEffect } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight, Check, X, Clock, Dumbbell, Utensils, ListTodo, LayoutGrid } from 'lucide-react';

// Types
type Board = 'todos' | 'exercise' | 'dinner';
type TaskStatus = 'open' | 'done' | 'skipped';
type Priority = 'low' | 'med' | 'high';

interface Task {
  id: string;
  board: Board;
  title: string;
  notes?: string;
  status: TaskStatus;
  scheduled_for: string;
  week_id: string;
  remind_at?: string;
  priority: Priority;
  created_at: string;
  updated_at: string;
  meta?: any;
}

interface Week {
  id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

// Utility functions
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getWeekId = (date: Date): string => {
  const start = getStartOfWeek(date);
  return `wk_${formatDate(start)}`;
};

const getWeekDates = (weekId: string): Date[] => {
  const dateStr = weekId.replace('wk_', '');
  const startDate = new Date(dateStr + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });
};

const generateId = () => `tsk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Storage wrapper
const storage = {
  async getTasks(): Promise<Task[]> {
    try {
      const result = await window.storage.get('tasks');
      return result ? JSON.parse(result.value) : [];
    } catch {
      return [];
    }
  },
  async saveTasks(tasks: Task[]): Promise<void> {
    await window.storage.set('tasks', JSON.stringify(tasks));
  },
  async getWeeks(): Promise<Week[]> {
    try {
      const result = await window.storage.get('weeks');
      return result ? JSON.parse(result.value) : [];
    } catch {
      return [];
    }
  },
  async saveWeeks(weeks: Week[]): Promise<void> {
    await window.storage.set('weeks', JSON.stringify(weeks));
  }
};

const WeeklyTaskApp = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<string>('');
  const [selectedBoard, setSelectedBoard] = useState<Board | 'all'>('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Initialize
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [loadedTasks, loadedWeeks] = await Promise.all([
        storage.getTasks(),
        storage.getWeeks()
      ]);
      
      setTasks(loadedTasks);
      setWeeks(loadedWeeks);
      
      const today = new Date();
      const weekId = getWeekId(today);
      setCurrentWeekId(weekId);
      setSelectedDate(formatDate(today));
      
      // Create current week if it doesn't exist
      if (!loadedWeeks.find(w => w.id === weekId)) {
        await createWeek(weekId);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Load error:', error);
      setLoading(false);
    }
  };

  const createWeek = async (weekId: string) => {
    const dates = getWeekDates(weekId);
    const newWeek: Week = {
      id: weekId,
      start_date: formatDate(dates[0]),
      end_date: formatDate(dates[6]),
      created_at: new Date().toISOString()
    };
    
    const updatedWeeks = [...weeks, newWeek];
    setWeeks(updatedWeeks);
    await storage.saveWeeks(updatedWeeks);
  };

  const addTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'week_id'>) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
      id: generateId(),
      week_id: getWeekId(new Date(task.scheduled_for + 'T00:00:00')),
      created_at: now,
      updated_at: now
    };
    
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    await storage.saveTasks(updatedTasks);
    return newTask;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId 
        ? { ...t, ...updates, updated_at: new Date().toISOString() }
        : t
    );
    setTasks(updatedTasks);
    await storage.saveTasks(updatedTasks);
  };

  const deleteTask = async (taskId: string) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    await storage.saveTasks(updatedTasks);
  };

  const startNextWeek = async () => {
    const currentDates = getWeekDates(currentWeekId);
    const nextStart = new Date(currentDates[0]);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextWeekId = getWeekId(nextStart);
    
    if (!weeks.find(w => w.id === nextWeekId)) {
      await createWeek(nextWeekId);
      
      // Rollover open tasks
      const openTasks = tasks.filter(t => 
        t.week_id === currentWeekId && t.status === 'open'
      );
      
      const nextWeekDates = getWeekDates(nextWeekId);
      const rolledTasks = openTasks.map(t => {
        const taskDate = new Date(t.scheduled_for);
        const dayOfWeek = taskDate.getDay();
        const newDate = nextWeekDates[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
        
        return {
          ...t,
          id: generateId(),
          week_id: nextWeekId,
          scheduled_for: formatDate(newDate),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
      
      const updatedTasks = [...tasks, ...rolledTasks];
      setTasks(updatedTasks);
      await storage.saveTasks(updatedTasks);
    }
    
    setCurrentWeekId(nextWeekId);
    const nextWeekDates = getWeekDates(nextWeekId);
    setSelectedDate(formatDate(nextWeekDates[0]));
  };

  const navigateWeek = async (direction: 'prev' | 'next') => {
    const currentDates = getWeekDates(currentWeekId);
    const newStart = new Date(currentDates[0]);
    newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
    const newWeekId = getWeekId(newStart);
    
    if (!weeks.find(w => w.id === newWeekId)) {
      await createWeek(newWeekId);
    }
    
    setCurrentWeekId(newWeekId);
    const newWeekDates = getWeekDates(newWeekId);
    setSelectedDate(formatDate(newWeekDates[0]));
  };

  const getTasksForDay = (date: Date, board: Board | 'all'): Task[] => {
    if (!date || isNaN(date.getTime())) {
      console.log('Invalid date:', date);
      return [];
    }
    const dateStr = formatDate(date);
    console.log('Getting tasks for:', dateStr, 'board:', board);
    console.log('All tasks:', tasks);
    const filtered = tasks.filter(t => {
      const matchesDate = t.scheduled_for === dateStr;
      const matchesBoard = board === 'all' || t.board === board;
      console.log('Task:', t.title, 'Date match:', matchesDate, 'Board match:', matchesBoard);
      return matchesDate && matchesBoard;
    }).sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return 0;
    });
    console.log('Filtered tasks:', filtered);
    return filtered;
  };

  const boardConfig = {
    all: { icon: LayoutGrid, label: 'All Tasks', color: 'gray' },
    todos: { icon: ListTodo, label: 'To-Dos', color: 'blue' },
    exercise: { icon: Dumbbell, label: 'Exercise', color: 'green' },
    dinner: { icon: Utensils, label: 'Dinner', color: 'orange' }
  };

  const weekDates = currentWeekId ? getWeekDates(currentWeekId) : [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
  console.log('Selected date string:', selectedDate);
  console.log('Selected date object:', selectedDateObj);
  console.log('Formatted selected date:', formatDate(selectedDateObj));
  const currentTasks = getTasksForDay(selectedDateObj, selectedBoard);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header - Fixed */}
      <div className="bg-gradient-to-r from-teal-400 to-teal-500 border-b sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3">
          {/* Logo and Title */}
          <div className="flex items-center justify-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <span className="text-2xl">🐝</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Bea More Organised</h1>
                <p className="text-xs text-teal-100">Daily Task Tracker</p>
              </div>
            </div>
          </div>
          
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-3 bg-white bg-opacity-20 rounded-lg px-3 py-2">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1.5 hover:bg-white hover:bg-opacity-30 rounded-lg active:bg-opacity-40 text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">
                {weekDates.length > 0 && `${weekDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
              </span>
            </div>
            <button
              onClick={() => navigateWeek('next')}
              className="p-1.5 hover:bg-white hover:bg-opacity-30 rounded-lg active:bg-opacity-40 text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Next Week Button */}
          <button
            onClick={startNextWeek}
            className="w-full px-3 py-2 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-500 text-sm font-bold active:bg-amber-600 shadow-sm mb-3"
          >
            🚀 Start Next Week
          </button>

          {/* Day Selector */}
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4">
            {weekDates.map((date, idx) => {
              const dateStr = formatDate(date);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === formatDate(new Date());
              const dayTasks = tasks.filter(t => t.scheduled_for === dateStr);
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg min-w-[60px] ${
                    isSelected
                      ? 'bg-amber-400 text-gray-900'
                      : isToday
                      ? 'bg-white text-teal-600 border-2 border-amber-400'
                      : 'bg-white bg-opacity-40 text-white'
                  }`}
                >
                  <div className="text-xs font-medium">{dayNames[idx]}</div>
                  <div className={`text-lg font-bold`}>
                    {date.getDate()}
                  </div>
                  {dayTasks.length > 0 && (
                    <div className={`text-xs mt-0.5 ${isSelected ? 'text-gray-700' : 'text-white'}`}>
                      {dayTasks.filter(t => t.status !== 'done').length}/{dayTasks.length}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Board Filter Tabs */}
        <div className="flex border-t border-teal-600 overflow-x-auto bg-teal-500">
          {(Object.keys(boardConfig) as (Board | 'all')[]).map(board => {
            const config = boardConfig[board];
            const Icon = config.icon;
            const boardTasks = tasks.filter(t => 
              t.scheduled_for === selectedDate && (board === 'all' || t.board === board)
            );
            
            return (
              <button
                key={board}
                onClick={() => setSelectedBoard(board)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors border-b-4 ${
                  selectedBoard === board
                    ? 'border-amber-400 text-white bg-teal-600'
                    : 'border-transparent text-teal-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm whitespace-nowrap">{config.label}</span>
                {boardTasks.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedBoard === board 
                      ? 'bg-amber-400 text-gray-900 font-bold' 
                      : 'bg-teal-600 text-white'
                  }`}>
                    {boardTasks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="px-4 py-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedDateObj.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>
          <p className="text-sm text-gray-600">
            {currentTasks.length} {currentTasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        <div className="space-y-2">
          {currentTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <Calendar className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-500">No tasks for this day</p>
              <p className="text-sm text-gray-400 mt-1">Tap the + button to add one</p>
            </div>
          ) : (
            currentTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => updateTask(task.id, {
                  status: task.status === 'done' ? 'open' : 'done'
                })}
                onEdit={() => {
                  setEditingTask(task);
                  setShowAddTask(true);
                }}
                onDelete={() => deleteTask(task.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setEditingTask({
            id: '',
            board: selectedBoard === 'all' ? 'todos' : selectedBoard,
            title: '',
            status: 'open',
            scheduled_for: selectedDate,
            week_id: currentWeekId,
            priority: 'med',
            created_at: '',
            updated_at: ''
          });
          setShowAddTask(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-400 text-gray-900 rounded-full shadow-lg flex items-center justify-center active:bg-amber-500 hover:shadow-xl transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Task Editor Modal */}
      {showAddTask && editingTask && (
        <TaskEditor
          task={editingTask}
          onSave={async (taskData) => {
            try {
              if (editingTask.id) {
                await updateTask(editingTask.id, taskData);
              } else {
                const newTask = await addTask(taskData);
                console.log('Task added:', newTask);
              }
              setShowAddTask(false);
              setEditingTask(null);
              // Force a refresh
              const loadedTasks = await storage.getTasks();
              setTasks(loadedTasks);
            } catch (error) {
              console.error('Error saving task:', error);
            }
          }}
          onCancel={() => {
            setShowAddTask(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
};

const TaskCard: React.FC<{
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ task, onToggle, onEdit, onDelete }) => {
  const boardConfig = {
    todos: { icon: ListTodo, label: 'To-Do', color: 'bg-blue-100 text-blue-700' },
    exercise: { icon: Dumbbell, label: 'Exercise', color: 'bg-green-100 text-green-700' },
    dinner: { icon: Utensils, label: 'Dinner', color: 'bg-orange-100 text-orange-700' }
  };

  const config = boardConfig[task.board];
  const Icon = config.icon;

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${
      task.status === 'done' ? 'border-gray-200' : 'border-gray-300'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              task.status === 'done'
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 hover:border-green-500 active:border-green-600'
            }`}
          >
            {task.status === 'done' && <Check className="w-4 h-4 text-white" />}
          </button>
          
          <div className="flex-1 min-w-0" onClick={onEdit}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                <Icon className="w-3 h-3" />
                {config.label}
              </span>
            </div>
            
            <div className={`text-base font-medium ${
              task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
            }`}>
              {task.title}
            </div>
            
            {task.notes && (
              <div className="text-sm text-gray-600 mt-1">{task.notes}</div>
            )}
            
            <div className="flex items-center gap-3 mt-2">
              {task.remind_at && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(task.remind_at).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </div>
              )}
              
              {task.priority === 'high' && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                  High Priority
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={onDelete}
            className="flex-shrink-0 p-2 hover:bg-red-50 active:bg-red-100 rounded-lg text-red-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskEditor: React.FC<{
  task: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'week_id'>) => void;
  onCancel: () => void;
}> = ({ task, onSave, onCancel }) => {
  const [formData, setFormData] = useState(task);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {task.id ? 'Edit Task' : 'Add Task'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['todos', 'exercise', 'dinner'] as Board[]).map(board => {
                const configs = {
                  todos: { icon: ListTodo, label: 'To-Dos' },
                  exercise: { icon: Dumbbell, label: 'Exercise' },
                  dinner: { icon: Utensils, label: 'Dinner' }
                };
                const config = configs[board];
                const Icon = config.icon;
                
                return (
                  <button
                    key={board}
                    onClick={() => setFormData({ ...formData, board })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 ${
                      formData.board === board
                        ? 'border-teal-600 bg-teal-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
              placeholder="Enter task title..."
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
              rows={3}
              placeholder="Additional details..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'med', 'high'] as Priority[]).map(priority => (
                <button
                  key={priority}
                  onClick={() => setFormData({ ...formData, priority })}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium ${
                    formData.priority === priority
                      ? 'border-teal-600 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {priority === 'low' ? 'Low' : priority === 'med' ? 'Medium' : 'High'}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reminder Time
            </label>
            <input
              type="time"
              value={formData.remind_at ? formData.remind_at.split('T')[1].slice(0, 5) : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const datetime = `${formData.scheduled_for}T${e.target.value}:00`;
                  setFormData({ ...formData, remind_at: datetime });
                } else {
                  setFormData({ ...formData, remind_at: undefined });
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
            />
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium active:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={!formData.title.trim()}
            className="flex-1 px-4 py-3 bg-teal-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed active:bg-teal-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyTaskApp;
