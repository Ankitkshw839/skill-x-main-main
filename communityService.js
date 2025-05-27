import { getDatabase, ref, get, set, push, update, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// Function to get user profile data
export async function getUserProfile(userId) {
    try {
        const database = getDatabase();
        const userRef = ref(database, `users/${userId}/profile`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            console.log("No profile data found for user:", userId);
            return null;
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        throw error;
    }
}

// Function to get user's enrolled courses
export async function getUserCourses(userId) {
    try {
        const database = getDatabase();
        const coursesRef = ref(database, `users/${userId}/recommendedCourses`);
        const snapshot = await get(coursesRef);
        
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            console.log("No course data found for user:", userId);
            return [];
        }
    } catch (error) {
        console.error("Error fetching user courses:", error);
        throw error;
    }
}

// Find potential connections based on similar courses
export async function findPotentialConnections(userId) {
    try {
        console.log(`Finding potential connections for user: ${userId}`);
        
        const database = getDatabase();
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            console.log("No users found in database");
            return [];
        }
        
        // Get current user's courses
        const userCourses = await getUserCourses(userId);
        if (!userCourses || userCourses.length === 0) {
            console.log(`User ${userId} has no courses`);
            return [];
        }
        
        console.log(`User ${userId} has ${userCourses.length} courses`);
        
        // Extract course titles for easier comparison
        const userCourseTitles = userCourses.map(course => {
            const title = course.title ? course.title.toLowerCase() : '';
            return title;
        }).filter(title => title !== '');
        
        console.log(`User ${userId} course titles:`, userCourseTitles);
        
        // Get current user's friend list
        const userFriendsRef = ref(database, `users/${userId}/friends`);
        const friendsSnapshot = await get(userFriendsRef);
        const currentFriends = friendsSnapshot.exists() ? Object.keys(friendsSnapshot.val()) : [];
        console.log(`User ${userId} has ${currentFriends.length} friends`);
        
        const potentialConnections = [];
        const allUsers = snapshot.val();
        const totalUsers = Object.keys(allUsers).length;
        console.log(`Found ${totalUsers} total users in database`);
        
        // Loop through all users
        for (const [otherUserId, userData] of Object.entries(allUsers)) {
            // Skip current user and existing friends
            if (otherUserId === userId) {
                console.log(`Skipping current user: ${otherUserId}`);
                continue;
            }
            
            if (currentFriends.includes(otherUserId)) {
                console.log(`Skipping existing friend: ${otherUserId}`);
                continue;
            }
            
            // Skip users without courses
            if (!userData.recommendedCourses) {
                console.log(`User ${otherUserId} has no recommendedCourses property`);
                continue;
            }
            
            if (!Array.isArray(userData.recommendedCourses)) {
                console.log(`User ${otherUserId} recommendedCourses is not an array:`, userData.recommendedCourses);
                continue;
            }
            
            // Get other user's course titles
            const otherUserCourseTitles = userData.recommendedCourses.map(course => 
                course.title ? course.title.toLowerCase() : ''
            ).filter(title => title !== '');
            
            console.log(`User ${otherUserId} has ${otherUserCourseTitles.length} courses:`, otherUserCourseTitles);
            
            // Calculate similarity score (number of matching courses)
            const matchingCourses = userCourseTitles.filter(title => 
                otherUserCourseTitles.includes(title)
            );
            
            const similarityScore = matchingCourses.length;
            console.log(`Matching courses between ${userId} and ${otherUserId}:`, matchingCourses);
            
            // Only include users with at least one matching course
            if (similarityScore > 0) {
                // Get user profile data
                const profile = userData.profile || {};
                const userName = profile.name || 'User';
                const userProfilePic = profile.profilePic || 'https://via.placeholder.com/100';
                
                potentialConnections.push({
                    userId: otherUserId,
                    name: userName,
                    profilePic: userProfilePic,
                    similarityScore,
                    matchingCourses: matchingCourses.length,
                    // Include the actual matching course titles
                    matchingCourseTitles: matchingCourses
                });
                
                console.log(`Added ${otherUserId} as potential connection with score ${similarityScore}`);
            } else {
                console.log(`No matching courses with user ${otherUserId}`);
            }
        }
        
        // Sort by similarity score (highest first)
        const sortedConnections = potentialConnections.sort((a, b) => b.similarityScore - a.similarityScore);
        console.log(`Found ${sortedConnections.length} potential connections for user ${userId}`);
        
        return sortedConnections;
        
    } catch (error) {
        console.error("Error finding potential connections:", error);
        throw error;
    }
}

// Send friend request
export async function sendFriendRequest(senderId, recipientId) {
    try {
        const database = getDatabase();
        
        // Get sender's profile data
        const senderProfile = await getUserProfile(senderId);
        const senderName = senderProfile?.name || 'User';
        const senderProfilePic = senderProfile?.profilePic || 'https://via.placeholder.com/100';
        
        // Create notification for recipient
        const notificationsRef = ref(database, `users/${recipientId}/notifications`);
        const newNotificationRef = push(notificationsRef);
        
        await set(newNotificationRef, {
            type: 'friend_request',
            senderId,
            senderName: senderName,
            senderProfilePic: senderProfilePic,
            status: 'pending',
            timestamp: Date.now()
        });
        
        // Update sender's sent requests
        const sentRequestsRef = ref(database, `users/${senderId}/sentRequests/${recipientId}`);
        await set(sentRequestsRef, {
            status: 'pending',
            timestamp: Date.now()
        });
        
        return true;
    } catch (error) {
        console.error("Error sending friend request:", error);
        throw error;
    }
}

// Accept friend request
export async function acceptFriendRequest(notificationId, senderId, recipientId) {
    try {
        const database = getDatabase();
        
        // Get profiles for both users
        const senderProfile = await getUserProfile(senderId);
        const recipientProfile = await getUserProfile(recipientId);
        
        // Update notification status
        const notificationRef = ref(database, `users/${recipientId}/notifications/${notificationId}`);
        await update(notificationRef, {
            status: 'accepted'
        });
        
        // Add to recipient's friend list with sender info
        const recipientFriendsRef = ref(database, `users/${recipientId}/friends/${senderId}`);
        await set(recipientFriendsRef, {
            name: senderProfile?.name || 'User',
            profilePic: senderProfile?.profilePic || 'https://via.placeholder.com/100',
            timestamp: Date.now()
        });
        
        // Add to sender's friend list with recipient info
        const senderFriendsRef = ref(database, `users/${senderId}/friends/${recipientId}`);
        await set(senderFriendsRef, {
            name: recipientProfile?.name || 'User',
            profilePic: recipientProfile?.profilePic || 'https://via.placeholder.com/100',
            timestamp: Date.now()
        });
        
        // Update sender's sent request
        const sentRequestRef = ref(database, `users/${senderId}/sentRequests/${recipientId}`);
        await update(sentRequestRef, {
            status: 'accepted'
        });
        
        return true;
    } catch (error) {
        console.error("Error accepting friend request:", error);
        throw error;
    }
}

// Get user's notifications
export async function getUserNotifications(userId) {
    try {
        const database = getDatabase();
        const notificationsRef = ref(database, `users/${userId}/notifications`);
        
        return new Promise((resolve, reject) => {
            onValue(notificationsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const notifications = [];
                    snapshot.forEach((childSnapshot) => {
                        notifications.push({
                            id: childSnapshot.key,
                            ...childSnapshot.val()
                        });
                    });
                    
                    // Sort by timestamp (newest first)
                    notifications.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(notifications);
                } else {
                    resolve([]);
                }
            }, (error) => {
                reject(error);
            });
        });
    } catch (error) {
        console.error("Error getting notifications:", error);
        throw error;
    }
}

// Get user's friends
export async function getUserFriends(userId) {
    try {
        const database = getDatabase();
        const friendsRef = ref(database, `users/${userId}/friends`);
        const snapshot = await get(friendsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const friends = [];
        
        // Process each friend entry
        snapshot.forEach((childSnapshot) => {
            const friendId = childSnapshot.key;
            const friendData = childSnapshot.val();
            
            friends.push({
                userId: friendId,
                name: friendData.name || 'User',
                profilePic: friendData.profilePic || 'https://via.placeholder.com/100',
                timestamp: friendData.timestamp
            });
        });
        
        // Sort by timestamp (newest first)
        return friends.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error("Error getting user friends:", error);
        throw error;
    }
} 