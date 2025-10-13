import React, { useState } from 'react';
import './TimeScheduler.css';

// Generate time slots for the next 7 days
const generateTimeSlots = () => {
  const slots = [];
  const now = new Date();
  
  // Available time windows (in hours from midnight)
  const timeWindows = [
    { start: 8, end: 10, label: 'Morning (8-10 AM)' },
    { start: 10, end: 12, label: 'Late Morning (10 AM-12 PM)' },
    { start: 12, end: 14, label: 'Lunch (12-2 PM)' },
    { start: 14, end: 16, label: 'Afternoon (2-4 PM)' },
    { start: 16, end: 18, label: 'Late Afternoon (4-6 PM)' },
    { start: 18, end: 20, label: 'Evening (6-8 PM)' },
    { start: 20, end: 22, label: 'Night (8-10 PM)' }
  ];
  
  // Generate slots for next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);
    
    const daySlots = timeWindows.map(window => {
      const startTime = new Date(date);
      startTime.setHours(window.start, 0, 0, 0);
      
      const endTime = new Date(date);
      endTime.setHours(window.end, 0, 0, 0);
      
      // Skip past time slots for today
      if (dayOffset === 0 && startTime <= now) {
        return null;
      }
      
      return {
        id: `${dayOffset}-${window.start}`,
        date: date,
        startTime: startTime,
        endTime: endTime,
        label: window.label,
        dayOffset: dayOffset,
        isToday: dayOffset === 0,
        isTomorrow: dayOffset === 1
      };
    }).filter(Boolean);
    
    slots.push(...daySlots);
  }
  
  return slots;
};

export default function TimeScheduler({ 
  isOpen, 
  onClose, 
  onTimeConfirm, 
  currentTimeSlot = null 
}) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(currentTimeSlot);
  const [timeSlots] = useState(generateTimeSlots());

  const handleTimeSelect = (slot) => {
    setSelectedTimeSlot(slot);
  };

  const handleConfirm = () => {
    if (selectedTimeSlot) {
      onTimeConfirm(selectedTimeSlot);
      onClose();
    }
  };

  const formatDate = (date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="time-scheduler-overlay">
      <div className="time-scheduler-content">
        <div className="scheduler-header">
          <h3>⏰ Choose Pickup Time</h3>
          <button onClick={onClose} className="close-scheduler-btn">&times;</button>
        </div>
        
        <div className="scheduler-instructions">
          <p>Select a 2-hour time window for your pickup. Both parties will be notified 15 minutes before.</p>
        </div>

        <div className="time-slots-container">
          <div className="time-slots-grid">
            {timeSlots.map((slot) => (
              <div
                key={slot.id}
                className={`time-slot ${selectedTimeSlot?.id === slot.id ? 'selected' : ''}`}
                onClick={() => handleTimeSelect(slot)}
              >
                <div className="slot-date">
                  {formatDate(slot.date)}
                </div>
                <div className="slot-time">
                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </div>
                <div className="slot-label">
                  {slot.label}
                </div>
                {slot.isToday && (
                  <div className="slot-badge today">Today</div>
                )}
                {slot.isTomorrow && (
                  <div className="slot-badge tomorrow">Tomorrow</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="scheduler-actions">
          <div className="selected-time-info">
            {selectedTimeSlot ? (
              <div className="time-selected">
                <span className="time-slot-name">
                  ⏰ {formatDate(selectedTimeSlot.date)} - {selectedTimeSlot.label}
                </span>
                <span className="time-slot-details">
                  {formatTime(selectedTimeSlot.startTime)} - {formatTime(selectedTimeSlot.endTime)}
                </span>
              </div>
            ) : (
              <div className="no-time-selected">
                No time slot selected
              </div>
            )}
          </div>
          
          <button 
            className="confirm-time-btn"
            onClick={handleConfirm}
            disabled={!selectedTimeSlot}
          >
            Confirm Time Window
          </button>
        </div>
      </div>
    </div>
  );
}
