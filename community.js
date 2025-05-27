import { 
    findPotentialConnections, 
    sendFriendRequest, 
    acceptFriendRequest,
    getUserNotifications,
    getUserFriends,
    getUserCourses,
    getUserProfile
} from './communityService.js';

// Store current user ID
let currentUserId = null;

// Initialize the community page
export async function initCommunityPage(userId) {
    if (!userId) {
        console.error("No user ID provided");
        document.getElementById('community-container').innerHTML = `
            <div class="auth-required">
                <h2>Authentication Required</h2>
                <p>Please log in to access the community features.</p>
                <a href="login.html" class="btn btn-primary">Log In</a>
            </div>
        `;
        return;
    }
    
    currentUserId = userId;
    
    // Set up UI tabs
    setupTabs();
    
    // Load user profile data
    try {
        const userProfile = await getUserProfile(userId);
        const auth = await import('./auth.js');
        const user = await auth.getCurrentUser();
        
        // Update sidebar username
        document.getElementById('sidebar-username').textContent = userProfile?.name || user?.displayName || 'Learner';
        
        // Update profile pictures
        // First try to use photoURL from Firebase auth (from Google login)
        if (user && user.photoURL) {
            const profilePics = document.querySelectorAll('.header-profile-pic, .sidebar-profile-pic, .status-profile-pic');
            profilePics.forEach(pic => pic.src = user.photoURL);
        }
        // Otherwise use profile picture from database if available
        else if (userProfile && userProfile.profilePic) {
            const profilePics = document.querySelectorAll('.header-profile-pic, .sidebar-profile-pic, .status-profile-pic');
            profilePics.forEach(pic => pic.src = userProfile.profilePic);
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
    }
    
    // Load initial data
    await Promise.all([
        loadPotentialConnections(),
        loadNotifications(),
        loadFriends(),
        loadUserCourses(),
        loadUserStats()
    ]);
    
    // Set up notification polling
    setInterval(() => {
        loadNotifications();
    }, 30000); // Check for new notifications every 30 seconds
}

// Set up the tab navigation
function setupTabs() {
    const tabButtons = document.querySelectorAll('.fb-tab-btn');
    const tabPanes = document.querySelectorAll('.fb-tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Set up notification icon click
    const notificationIcon = document.getElementById('notification-icon');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', (e) => {
            e.preventDefault();
            // Activate notifications tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(content => content.classList.remove('active'));
            
            const notificationsBtn = document.querySelector('[data-tab="notifications-tab"]');
            if (notificationsBtn) {
                notificationsBtn.classList.add('active');
                document.getElementById('notifications-tab').classList.add('active');
            }
        });
    }
}

// Load user courses for sidebar
async function loadUserCourses() {
    try {
        const sidebarCoursesContainer = document.getElementById('sidebar-courses');
        if (!sidebarCoursesContainer) return;
        
        const courses = await getUserCourses(currentUserId);
        
        if (!courses || courses.length === 0) {
            sidebarCoursesContainer.innerHTML = `
                <div class="sidebar-empty">
                    <p>No courses enrolled yet</p>
                    <a href="mycourses.html" class="sidebar-link">Browse Courses</a>
                </div>
            `;
            return;
        }
        
        let html = '';
        const maxCourses = Math.min(courses.length, 5); // Show max 5 courses in sidebar
        
        for (let i = 0; i < maxCourses; i++) {
            const course = courses[i];
            const progress = course.progress || 0;
            
            html += `
                <a href="mycourses.html" class="sidebar-course">
                    <div class="sidebar-course-img">
                        <img src="${course.imageUrl || 'https://via.placeholder.com/40'}" alt="${course.title}">
                    </div>
                    <div class="sidebar-course-info">
                        <div class="sidebar-course-title">${course.title}</div>
                        <div class="sidebar-progress-bar">
                            <div class="sidebar-progress" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </a>
            `;
        }
        
        if (courses.length > maxCourses) {
            html += `
                <a href="mycourses.html" class="sidebar-more">
                    View all ${courses.length} courses
                </a>
            `;
        }
        
        sidebarCoursesContainer.innerHTML = html;
        
        // Update connection count
        document.getElementById('connections-count').textContent = '0';
        
    } catch (error) {
        console.error("Error loading user courses:", error);
    }
}

// Load user stats for sidebar
async function loadUserStats() {
    try {
        // Get courses
        const courses = await getUserCourses(currentUserId);
        const coursesCount = courses ? courses.length : 0;
        document.getElementById('stats-courses').textContent = coursesCount;
        
        // Calculate hours (based on course durations and progress)
        let totalHours = 0;
        if (courses && courses.length > 0) {
            courses.forEach(course => {
                const duration = course.duration || 8; // Default 8 weeks
                const progress = course.progress || 0;
                // Assume 5 hours per week
                totalHours += Math.round((duration * 5) * (progress / 100));
            });
        }
        document.getElementById('stats-hours').textContent = totalHours;
        
        // Get friends count
        const friends = await getUserFriends(currentUserId);
        const friendsCount = friends ? friends.length : 0;
        document.getElementById('stats-connections').textContent = friendsCount;
        document.getElementById('connections-count').textContent = friendsCount;
        
    } catch (error) {
        console.error("Error loading user stats:", error);
    }
}

// Load potential connections based on similar courses
async function loadPotentialConnections() {
    try {
        const connectionsContainer = document.getElementById('potential-connections');
        connectionsContainer.innerHTML = '<div class="loading">Finding potential connections...</div>';
        
        const connections = await findPotentialConnections(currentUserId);
        console.log("Potential connections:", connections);
        
        if (connections.length === 0) {
            connectionsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No potential connections found based on your courses.</p>
                    <p>Try adding more courses to your profile!</p>
                </div>
            `;
            return;
        }
        
        // Build the HTML for connections
        let html = '<div class="connections-grid">';
        
        connections.forEach(connection => {
            html += `
                <div class="connection-card">
                    <div class="connection-profile">
                        <img src="${connection.profilePic || 'https://via.placeholder.com/100'}" alt="${connection.name}" class="profile-pic">
                        <h3>${connection.name}</h3>
                    </div>
                    <div class="connection-details">
                        <p class="match-count"><i class="fas fa-book"></i> <strong>${connection.matchingCourses} matching ${connection.matchingCourses > 1 ? 'courses' : 'course'}</strong></p>
                        <div class="matching-courses-list">
                            ${connection.matchingCourseTitles.map(course => 
                                `<span class="course-tag">${course}</span>`
                            ).join('')}
                        </div>
                    </div>
                    <button class="connect-btn" data-user-id="${connection.userId}">Connect</button>
                </div>
            `;
        });
        
        html += '</div>';
        connectionsContainer.innerHTML = html;
        
        // Add event listeners to connect buttons
        document.querySelectorAll('.connect-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const recipientId = event.target.getAttribute('data-user-id');
                await handleSendFriendRequest(recipientId, event.target);
            });
        });
        
    } catch (error) {
        console.error("Error loading potential connections:", error);
        document.getElementById('potential-connections').innerHTML = `
            <div class="alert alert-danger">
                Error loading connections. Please try again later.
            </div>
        `;
    }
}

// Handle sending a friend request
async function handleSendFriendRequest(recipientId, buttonElement) {
    try {
        buttonElement.disabled = true;
        buttonElement.textContent = 'Sending...';
        
        await sendFriendRequest(currentUserId, recipientId);
        
        buttonElement.textContent = 'Request Sent';
        buttonElement.classList.add('request-sent');
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'alert alert-success';
        successMessage.textContent = 'Friend request sent successfully!';
        buttonElement.parentNode.appendChild(successMessage);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
        
    } catch (error) {
        console.error("Error sending friend request:", error);
        buttonElement.textContent = 'Error';
        buttonElement.classList.add('request-error');
        
        // Show error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger';
        errorMessage.textContent = 'Failed to send request. Please try again.';
        buttonElement.parentNode.appendChild(errorMessage);
        
        // Reset button after 3 seconds
        setTimeout(() => {
            buttonElement.disabled = false;
            buttonElement.textContent = 'Connect';
            buttonElement.classList.remove('request-error');
            errorMessage.remove();
        }, 3000);
    }
}

// Load user notifications
async function loadNotifications() {
    try {
        const notificationsContainer = document.getElementById('notifications');
        
        const notifications = await getUserNotifications(currentUserId);
        
        // Update notification badge
        const pendingNotifications = notifications.filter(n => n.status === 'pending').length;
        const notificationBadge = document.getElementById('notification-badge');
        const headerNotificationBadge = document.getElementById('header-notification-badge');
        
        if (pendingNotifications > 0) {
            notificationBadge.textContent = pendingNotifications;
            notificationBadge.style.display = 'flex';
            
            headerNotificationBadge.textContent = pendingNotifications;
            headerNotificationBadge.style.display = 'flex';
        } else {
            notificationBadge.style.display = 'none';
            headerNotificationBadge.style.display = 'none';
        }
        
        if (notifications.length === 0) {
            notificationsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No notifications yet.</p>
                </div>
            `;
            return;
        }
        
        // Build the HTML for notifications
        let html = '<div class="notifications-list">';
        
        notifications.forEach(notification => {
            if (notification.type === 'friend_request') {
                const isPending = notification.status === 'pending';
                
                html += `
                    <div class="notification-item ${isPending ? 'pending' : notification.status}">
                        <div class="notification-profile">
                            <img src="${notification.senderProfilePic || 'https://via.placeholder.com/50'}" alt="${notification.senderName}" class="notification-pic">
                        </div>
                        <div class="notification-content">
                            <p><strong>${notification.senderName}</strong> wants to connect with you</p>
                            <p class="notification-time">${formatTimestamp(notification.timestamp)}</p>
                        </div>
                        <div class="notification-actions">
                            ${isPending ? `
                                <button class="accept-btn" data-notification-id="${notification.id}" data-sender-id="${notification.senderId}">Accept</button>
                                <button class="decline-btn" data-notification-id="${notification.id}" data-sender-id="${notification.senderId}">Decline</button>
                            ` : `
                                <span class="status-badge ${notification.status}">${notification.status}</span>
                            `}
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        notificationsContainer.innerHTML = html;
        
        // Add event listeners to action buttons
        document.querySelectorAll('.accept-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const notificationId = event.target.getAttribute('data-notification-id');
                const senderId = event.target.getAttribute('data-sender-id');
                await handleAcceptFriendRequest(notificationId, senderId, event.target);
            });
        });
        
        document.querySelectorAll('.decline-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const notificationId = event.target.getAttribute('data-notification-id');
                // Implement decline functionality if needed
            });
        });
        
    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

// Handle accepting a friend request
async function handleAcceptFriendRequest(notificationId, senderId, buttonElement) {
    try {
        const actionsContainer = buttonElement.parentNode;
        actionsContainer.innerHTML = '<span class="processing">Processing...</span>';
        
        await acceptFriendRequest(notificationId, senderId, currentUserId);
        
        actionsContainer.innerHTML = '<span class="status-badge accepted">Accepted</span>';
        
        // Refresh friends list and stats
        await Promise.all([
            loadFriends(),
            loadUserStats()
        ]);
        
    } catch (error) {
        console.error("Error accepting friend request:", error);
        actionsContainer.innerHTML = `
            <span class="status-badge error">Error</span>
            <button class="accept-btn" data-notification-id="${notificationId}" data-sender-id="${senderId}">Try Again</button>
        `;
        
        // Re-attach event listener
        actionsContainer.querySelector('.accept-btn').addEventListener('click', async (event) => {
            await handleAcceptFriendRequest(notificationId, senderId, event.target);
        });
    }
}

// Load user's friends
async function loadFriends() {
    try {
        const friendsContainer = document.getElementById('friends');
        
        const friends = await getUserFriends(currentUserId);
        
        if (friends.length === 0) {
            friendsContainer.innerHTML = `
                <div class="empty-state">
                    <p>You haven't connected with anyone yet.</p>
                    <p>Check out the potential connections tab to find people with similar interests!</p>
                </div>
            `;
            return;
        }
        
        // Build the HTML for friends
        let html = '<div class="friends-grid">';
        
        friends.forEach(friend => {
            html += `
                <div class="friend-card">
                    <img src="${friend.profilePic || 'https://via.placeholder.com/100'}" alt="${friend.name}" class="friend-pic">
                    <h3>${friend.name}</h3>
                    <p class="friend-since">Connected ${formatTimestamp(friend.timestamp)}</p>
                    <button class="message-btn" data-user-id="${friend.userId}">Message</button>
                    <button class="view-profile-btn" data-user-id="${friend.userId}">View Profile</button>
                </div>
            `;
        });
        
        html += '</div>';
        friendsContainer.innerHTML = html;
        
        // Add event listeners to message buttons
        document.querySelectorAll('.message-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const friendId = event.target.getAttribute('data-user-id');
                // Implement messaging functionality
                alert('Messaging feature coming soon!');
            });
        });
        
        // Add event listeners to view profile buttons
        document.querySelectorAll('.view-profile-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const friendId = event.target.getAttribute('data-user-id');
                try {
                    const friendProfile = await getUserProfile(friendId);
                    
                    // Display profile in a modal
                    showProfileModal(friendProfile, friendId);
                } catch (error) {
                    console.error("Error loading friend profile:", error);
                    alert('Could not load profile. Please try again later.');
                }
            });
        });
        
    } catch (error) {
        console.error("Error loading friends:", error);
        document.getElementById('friends').innerHTML = `
            <div class="alert alert-danger">
                Error loading friends. Please try again later.
            </div>
        `;
    }
}

// Show profile modal
function showProfileModal(profile, userId) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    
    // Create modal content
    modal.innerHTML = `
        <div class="profile-modal-content">
            <span class="close-modal">&times;</span>
            <div class="profile-modal-header">
                <img src="${profile?.profilePic || 'https://via.placeholder.com/100'}" alt="${profile?.name || 'User'}" class="modal-profile-pic">
                <h2>${profile?.name || 'User'}</h2>
            </div>
            <div class="profile-modal-body">
                ${profile?.email ? `<p><strong>Email:</strong> ${profile.email}</p>` : ''}
                ${profile?.phone ? `<p><strong>Phone:</strong> ${profile.phone}</p>` : ''}
                ${profile?.dob ? `<p><strong>Date of Birth:</strong> ${profile.dob}</p>` : ''}
                ${profile?.bio ? `<p><strong>Bio:</strong> ${profile.bio}</p>` : ''}
                ${profile?.interests ? `<p><strong>Interests:</strong> ${Array.isArray(profile.interests) ? profile.interests.join(', ') : profile.interests}</p>` : ''}
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.appendChild(modal);
    
    // Add close functionality
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close when clicking outside modal content
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Handle status update post
document.addEventListener('DOMContentLoaded', () => {
    const statusForm = document.querySelector('.status-update-card');
    const statusInput = document.querySelector('.status-input');
    const postButton = document.querySelector('.status-post');
    
    if (statusForm && statusInput && postButton) {
        postButton.addEventListener('click', () => {
            const statusText = statusInput.value.trim();
            if (statusText) {
                alert('Status posting feature coming soon!');
                statusInput.value = '';
            }
        });
    }
});

// Helper function to format timestamps
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay > 30) {
        return date.toLocaleDateString();
    } else if (diffDay > 0) {
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    } else if (diffHour > 0) {
        return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffMin > 0) {
        return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
} 