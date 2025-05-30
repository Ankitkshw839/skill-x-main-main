import { getDatabase, ref, get, set, push, update, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// ML-based friend matching function
export async function findFriendsWithSimilarInterests(userId) {
    try {
        console.log(`Finding friends with similar interests for user: ${userId}`);
        
        const database = getDatabase();
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            console.log("No users found in database");
            return { matches: [], message: "No users found" };
        }
        
        // Get current user's data
        const currentUserRef = ref(database, `users/${userId}`);
        const currentUserSnapshot = await get(currentUserRef);
        
        if (!currentUserSnapshot.exists()) {
            console.log(`User ${userId} not found`);
            return { matches: [], message: "User not found" };
        }
        
        const currentUserData = currentUserSnapshot.val();
        console.log("Current user data:", currentUserData);
        
        // FOCUS ON SPECIFIC INTERESTS FIRST - This is the most important part
        const userSpecificInterests = [];
        
        // Get specific interests (highest priority)
        if (currentUserData.specificInterests) {
            Object.values(currentUserData.specificInterests)
                .filter(interest => typeof interest === 'string')
                .forEach(interest => userSpecificInterests.push(interest.toLowerCase()));
        }
        
        // Get main interest if available
        if (currentUserData.mainInterest && typeof currentUserData.mainInterest === 'string') {
            userSpecificInterests.push(currentUserData.mainInterest.toLowerCase());
        }
        
        // If no specific interests, check enrolled courses
        if (userSpecificInterests.length === 0 && currentUserData.enrolledCourses) {
            const enrolledCourses = Array.isArray(currentUserData.enrolledCourses) 
                ? currentUserData.enrolledCourses 
                : Object.values(currentUserData.enrolledCourses);
                
            enrolledCourses.forEach(course => {
                if (course.title) userSpecificInterests.push(course.title.toLowerCase());
            });
        }
        
        console.log(`User ${userId} has specific interests:`, userSpecificInterests);
        
        if (userSpecificInterests.length === 0) {
            console.log(`User ${userId} has no specific interests`);
            return { 
                matches: [], 
                message: "You haven't added any interests or enrolled in any courses yet. Add some interests to find potential connections!"
            };
        }
        
        // Get current user's friend list to exclude them
        const userFriendsRef = ref(database, `users/${userId}/friends`);
        const friendsSnapshot = await get(userFriendsRef);
        const currentFriends = friendsSnapshot.exists() ? Object.keys(friendsSnapshot.val()) : [];
        
        // Also exclude users who already have pending friend requests
        const sentRequestsRef = ref(database, `users/${userId}/sentRequests`);
        const sentRequestsSnapshot = await get(sentRequestsRef);
        const sentRequests = sentRequestsSnapshot.exists() ? Object.keys(sentRequestsSnapshot.val()) : [];
        
        // Helper function to determine if two interests are similar
        function areSimilarInterests(interest1, interest2) {
            // Convert both to lowercase for case-insensitive comparison
            interest1 = interest1.toLowerCase();
            interest2 = interest2.toLowerCase();
            
            // Direct match
            if (interest1 === interest2) return true;
            
            // Check for programming language matches
            const programmingKeywords = {
                'c++': ['c++', 'cpp', 'c plus plus', 'programming'],
                'python': ['python', 'programming'],
                'java': ['java', 'programming'],
                'javascript': ['javascript', 'js', 'programming'],
                'web development': ['web', 'web dev', 'html', 'css', 'javascript', 'frontend', 'backend'],
                'programming': ['code', 'coding', 'development', 'software']
            };
            
            // Check if interest1 is a key in programmingKeywords
            for (const [key, keywords] of Object.entries(programmingKeywords)) {
                if (interest1.includes(key)) {
                    // Check if interest2 contains any of the related keywords
                    if (keywords.some(keyword => interest2.includes(keyword))) {
                        return true;
                    }
                }
                
                // Check the reverse as well
                if (interest2.includes(key)) {
                    if (keywords.some(keyword => interest1.includes(keyword))) {
                        return true;
                    }
                }
            }
            
            // Check if they share common words (for multi-word interests)
            const words1 = interest1.split(/\s+/);
            const words2 = interest2.split(/\s+/);
            
            // If they share significant words (excluding common words like "and", "for", etc.)
            const significantWords = ['programming', 'development', 'web', 'data', 'science', 'machine', 'learning', 'design', 'security'];
            
            for (const word of significantWords) {
                if (interest1.includes(word) && interest2.includes(word)) {
                    return true;
                }
            }
            
            return false;
        }
        
        const matches = [];
        const allUsers = snapshot.val();
        
        // Loop through all users to find matches
        for (const [otherUserId, userData] of Object.entries(allUsers)) {
            // Skip current user, existing friends, and users with pending requests
            if (otherUserId === userId || 
                currentFriends.includes(otherUserId) || 
                sentRequests.includes(otherUserId)) {
                continue;
            }
            
            // Get other user's specific interests (FOCUS ON SPECIFIC INTERESTS ONLY)
            const otherUserSpecificInterests = [];
            
            // Get specific interests (highest priority)
            if (userData.specificInterests) {
                Object.values(userData.specificInterests)
                    .filter(interest => typeof interest === 'string')
                    .forEach(interest => otherUserSpecificInterests.push(interest.toLowerCase()));
            }
            
            // Get main interest if available
            if (userData.mainInterest && typeof userData.mainInterest === 'string') {
                otherUserSpecificInterests.push(userData.mainInterest.toLowerCase());
            }
            
            // If no specific interests, check enrolled courses
            if (otherUserSpecificInterests.length === 0 && userData.enrolledCourses) {
                const enrolledCourses = Array.isArray(userData.enrolledCourses) 
                    ? userData.enrolledCourses 
                    : Object.values(userData.enrolledCourses);
                    
                enrolledCourses.forEach(course => {
                    if (course.title) otherUserSpecificInterests.push(course.title.toLowerCase());
                });
            }
            
            if (otherUserSpecificInterests.length === 0) {
                // Skip users without any interests
                continue;
            }
            
            // Find matching interests using our enhanced similarity check
            const matchingInterestPairs = [];
            
            userSpecificInterests.forEach(userInterest => {
                otherUserSpecificInterests.forEach(otherInterest => {
                    if (areSimilarInterests(userInterest, otherInterest)) {
                        // Store both interests for better display
                        matchingInterestPairs.push({
                            userInterest,
                            otherInterest,
                            exact: userInterest === otherInterest
                        });
                    }
                });
            });
            
            // If there are matching interests, add to matches
            if (matchingInterestPairs.length > 0) {
                // Get user profile for display
                const userProfile = userData.profile || {};
                
                // Prioritize finding the user's name from multiple sources
                let userName = 'User';
                if (userProfile.name) {
                    userName = userProfile.name;
                } else if (userData.email) {
                    // Extract name from email (e.g., john.doe@example.com -> John Doe)
                    const emailName = userData.email.split('@')[0].replace(/[._]/g, ' ');
                    userName = emailName.split(' ')
                        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(' ');
                } else if (userData.displayName) {
                    userName = userData.displayName;
                }
                
                // Convert matching interest pairs to common courses format
                const commonCourses = matchingInterestPairs.map(pair => ({
                    title: pair.userInterest,
                    otherTitle: pair.otherInterest,
                    matchType: pair.exact ? 'exact' : 'similar'
                }));
                
                matches.push({
                    userId: otherUserId,
                    name: userName,
                    profilePic: userProfile.profilePic || 'https://via.placeholder.com/100',
                    email: userProfile.email || userData.email || 'No email available',
                    commonCourses: commonCourses,
                    matchScore: calculateEnhancedMatchScore(commonCourses),
                    bio: userProfile.bio || ''
                });
            }
        }
        
        // Sort matches by match score (highest first)
        matches.sort((a, b) => b.matchScore - a.matchScore);
        
        return { 
            matches, 
            message: matches.length > 0 ? 
                `Found ${matches.length} potential friends with similar interests!` : 
                "No matches found with your interests. Try adding more interests to find connections!"
        };
    } catch (error) {
        console.error("Error finding friends with similar interests:", error);
        throw error;
    }
}

// Helper function to calculate enhanced match score
function calculateEnhancedMatchScore(commonCourses) {
    let score = 0;
    
    commonCourses.forEach(course => {
        // Weight different match types
        switch(course.matchType) {
            case 'exact':
                score += 10; // Exact match
                break;
            case 'similar':
                score += 5;  // Similar match
                break;
        }
        
        // Bonus points for programming-related matches
        const programmingKeywords = ['c++', 'python', 'java', 'javascript', 'programming', 'development', 'web'];
        
        programmingKeywords.forEach(keyword => {
            if (course.title.toLowerCase().includes(keyword)) {
                score += 2; // Bonus for programming interests
            }
        });
    });
    
    return score;
}

// Helper function to find friends with similar courses
async function findFriendsWithSimilarCourses(userId) {
    try {
        console.log(`Finding friends with similar courses for user: ${userId}`);
        
        const database = getDatabase();
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        // Get current user's courses
        const userCoursesData = await getUserCourses(userId);
        const userCourses = userCoursesData.all; // Use all courses for matching
        
        if (!userCourses || userCourses.length === 0) {
            console.log(`User ${userId} has no courses`);
            return { matches: [], message: "You haven't enrolled in any courses yet" };
        }
        
        console.log(`User ${userId} has ${userCourses.length} courses`);
        
        // Extract course titles and IDs for easier comparison
        const userCourseTitles = userCourses.map(course => {
            return {
                id: course.id || '',
                title: course.title ? course.title.toLowerCase() : ''
            };
        }).filter(course => course.title !== '');
        
        console.log(`User ${userId} course titles:`, userCourseTitles);
        
        // Get current user's friend list to exclude them
        const userFriendsRef = ref(database, `users/${userId}/friends`);
        const friendsSnapshot = await get(userFriendsRef);
        const currentFriends = friendsSnapshot.exists() ? Object.keys(friendsSnapshot.val()) : [];
        
        // Also exclude users who already have pending friend requests
        const sentRequestsRef = ref(database, `users/${userId}/sentRequests`);
        const sentRequestsSnapshot = await get(sentRequestsRef);
        const sentRequests = sentRequestsSnapshot.exists() ? Object.keys(sentRequestsSnapshot.val()) : [];
        
        const matches = [];
        const allUsers = snapshot.val();
        
        // Loop through all users to find matches
        for (const [otherUserId, userData] of Object.entries(allUsers)) {
            // Skip current user, existing friends, and users with pending requests
            if (otherUserId === userId || 
                currentFriends.includes(otherUserId) || 
                sentRequests.includes(otherUserId)) {
                continue;
            }
            
            // Skip users without courses
            if (!userData.recommendedCourses && !userData.enrolledCourses) {
                continue;
            }
            
            // Get other user's courses
            let otherUserCourses = [];
            
            if (userData.recommendedCourses) {
                if (Array.isArray(userData.recommendedCourses)) {
                    otherUserCourses = [...otherUserCourses, ...userData.recommendedCourses];
                } else {
                    otherUserCourses = [...otherUserCourses, ...Object.values(userData.recommendedCourses)];
                }
            }
            
            if (userData.enrolledCourses) {
                if (Array.isArray(userData.enrolledCourses)) {
                    otherUserCourses = [...otherUserCourses, ...userData.enrolledCourses];
                } else {
                    otherUserCourses = [...otherUserCourses, ...Object.values(userData.enrolledCourses)];
                }
            }
            
            // Get other user's course titles
            const otherUserCourseTitles = otherUserCourses.map(course => {
                return {
                    id: course.id || '',
                    title: course.title ? course.title.toLowerCase() : ''
                };
            }).filter(course => course.title !== '');
            
            // Find common courses (ML-based matching)
            const commonCourses = [];
            
            // First pass: direct ID matching (most accurate)
            userCourseTitles.forEach(userCourse => {
                otherUserCourseTitles.forEach(otherCourse => {
                    if (userCourse.id && otherCourse.id && userCourse.id === otherCourse.id) {
                        commonCourses.push({
                            id: userCourse.id,
                            title: userCourse.title,
                            matchType: 'exact'
                        });
                    }
                });
            });
            
            // Second pass: title matching for courses without IDs
            userCourseTitles.forEach(userCourse => {
                otherUserCourseTitles.forEach(otherCourse => {
                    if (userCourse.title === otherCourse.title) {
                        // Check if this course is already in commonCourses
                        const alreadyAdded = commonCourses.some(course => 
                            course.title === userCourse.title
                        );
                        
                        if (!alreadyAdded) {
                            commonCourses.push({
                                title: userCourse.title,
                                matchType: 'title'
                            });
                        }
                    }
                });
            });
            
            // If there are common courses, add to matches
            if (commonCourses.length > 0) {
                // Get user profile for display
                const userProfile = userData.profile || {};
                
                matches.push({
                    userId: otherUserId,
                    name: userProfile.name || userData.email || 'User',
                    profilePic: userProfile.profilePic || 'https://via.placeholder.com/100',
                    email: userProfile.email || userData.email || 'No email available',
                    commonCourses: commonCourses,
                    matchScore: calculateMatchScore(commonCourses),
                    bio: userProfile.bio || ''
                });
            }
        }
        
        // Sort matches by match score (highest first)
        matches.sort((a, b) => b.matchScore - a.matchScore);
        
        return { 
            matches, 
            message: matches.length > 0 ? 
                `Found ${matches.length} potential friends with similar courses!` : 
                "No matches found with your current courses"
        };
    } catch (error) {
        console.error("Error finding friends with similar courses:", error);
        return { matches: [], message: "Error finding matches" };
    }
}

// Helper function to calculate match score based on common courses
function calculateMatchScore(commonCourses) {
    let score = 0;
    
    commonCourses.forEach(course => {
        // Weight different match types
        switch(course.matchType) {
            case 'exact':
                score += 10; // Exact course ID match
                break;
            case 'title':
                score += 5;  // Exact title match
                break;
            case 'similar':
                // Score based on similarity (0-5 range)
                score += course.similarityScore * 5;
                break;
        }
    });
    
    return score;
}

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
        
        // First check for enrolled courses
        const enrolledCoursesRef = ref(database, `users/${userId}/enrolledCourses`);
        const enrolledSnapshot = await get(enrolledCoursesRef);
        
        // Then check for recommended courses
        const recommendedCoursesRef = ref(database, `users/${userId}/recommendedCourses`);
        const recommendedSnapshot = await get(recommendedCoursesRef);
        
        // Also check for specific interests
        const specificInterestsRef = ref(database, `users/${userId}/specificInterests`);
        const specificInterestsSnapshot = await get(specificInterestsRef);
        
        let enrolledCourses = [];
        let recommendedCourses = [];
        let interestCourses = [];
        
        // Add enrolled courses if they exist
        if (enrolledSnapshot.exists()) {
            const enrolledData = enrolledSnapshot.val();
            if (Array.isArray(enrolledData)) {
                enrolledCourses = [...enrolledData];
            } else {
                enrolledCourses = [...Object.values(enrolledData)];
            }
            console.log("Found enrolled courses:", enrolledCourses.length);
        }
        
        // Add recommended courses if they exist
        if (recommendedSnapshot.exists()) {
            const recommendedData = recommendedSnapshot.val();
            if (Array.isArray(recommendedData)) {
                recommendedCourses = [...recommendedData];
            } else {
                recommendedCourses = [...Object.values(recommendedData)];
            }
            console.log("Found recommended courses:", recommendedCourses.length || 0);
        }
        
        // Add specific interests as courses if they exist
        if (specificInterestsSnapshot.exists()) {
            const specificInterests = specificInterestsSnapshot.val();
            
            if (typeof specificInterests === 'object') {
                Object.entries(specificInterests).forEach(([key, value]) => {
                    // Skip if value is not a string (interest name)
                    if (typeof value !== 'string') return;
                    
                    interestCourses.push({
                        id: `interest-${key}`,
                        title: value,
                        description: `Course related to your interest in ${value}`,
                        progress: 0,
                        imageUrl: 'https://img.freepik.com/free-vector/online-tutorials-concept_23-2148529858.jpg',
                        isInterest: true
                    });
                });
            }
            
            console.log("Found specific interests converted to courses:", interestCourses.length);
        }
        
        // Also check the old location for enrollments
        const oldEnrollmentsRef = ref(database, `enrollments/${userId}`);
        const oldEnrollmentsSnapshot = await get(oldEnrollmentsRef);
        
        if (oldEnrollmentsSnapshot.exists()) {
            const oldEnrollments = oldEnrollmentsSnapshot.val();
            enrolledCourses = [...enrolledCourses, ...Object.values(oldEnrollments)];
            console.log("Found courses in old location:", Object.values(oldEnrollments).length);
        }
        
        // For community page and other features that need all courses
        const allCourses = [...enrolledCourses, ...recommendedCourses, ...interestCourses];
        
        // Return an object with all types of courses
        return {
            all: allCourses,
            enrolled: enrolledCourses,
            recommended: recommendedCourses,
            interests: interestCourses
        };
    } catch (error) {
        console.error("Error fetching user courses:", error);
        return {
            all: [],
            enrolled: [],
            recommended: [],
            interests: []
        };
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
        
        // Get current user's data
        const currentUserRef = ref(database, `users/${userId}`);
        const currentUserSnapshot = await get(currentUserRef);
        
        if (!currentUserSnapshot.exists()) {
            console.log(`User ${userId} not found`);
            return [];
        }
        
        const currentUserData = currentUserSnapshot.val();
        console.log("Current user data:", currentUserData);
        
        // FOCUS ON SPECIFIC INTERESTS FIRST - This is the most important part
        const userSpecificInterests = [];
        
        // Get specific interests (highest priority)
        if (currentUserData.specificInterests) {
            Object.values(currentUserData.specificInterests)
                .filter(interest => typeof interest === 'string')
                .forEach(interest => userSpecificInterests.push(interest.toLowerCase()));
        }
        
        // Get main interest if available
        if (currentUserData.mainInterest && typeof currentUserData.mainInterest === 'string') {
            userSpecificInterests.push(currentUserData.mainInterest.toLowerCase());
        }
        
        // If no specific interests, check enrolled courses
        if (userSpecificInterests.length === 0 && currentUserData.enrolledCourses) {
            const enrolledCourses = Array.isArray(currentUserData.enrolledCourses) 
                ? currentUserData.enrolledCourses 
                : Object.values(currentUserData.enrolledCourses);
                
            enrolledCourses.forEach(course => {
                if (course.title) userSpecificInterests.push(course.title.toLowerCase());
            });
        }
        
        console.log(`User ${userId} has specific interests:`, userSpecificInterests);
        
        if (userSpecificInterests.length === 0) {
            console.log(`User ${userId} has no specific interests`);
            return [];
        }
        
        // Get current user's friend list
        const userFriendsRef = ref(database, `users/${userId}/friends`);
        const friendsSnapshot = await get(userFriendsRef);
        const currentFriends = friendsSnapshot.exists() ? Object.keys(friendsSnapshot.val()) : [];
        console.log(`User ${userId} has ${currentFriends.length} friends`);
        
        const potentialConnections = [];
        const allUsers = snapshot.val();
        const totalUsers = Object.keys(allUsers).length;
        console.log(`Found ${totalUsers} total users in database`);
        
        // Helper function to determine if two interests are similar
        function areSimilarInterests(interest1, interest2) {
            // Convert both to lowercase for case-insensitive comparison
            interest1 = interest1.toLowerCase();
            interest2 = interest2.toLowerCase();
            
            // Direct match
            if (interest1 === interest2) return true;
            
            // Check for programming language matches
            const programmingKeywords = {
                'c++': ['c++', 'cpp', 'c plus plus', 'programming'],
                'python': ['python', 'programming'],
                'java': ['java', 'programming'],
                'javascript': ['javascript', 'js', 'programming'],
                'web development': ['web', 'web dev', 'html', 'css', 'javascript', 'frontend', 'backend'],
                'programming': ['code', 'coding', 'development', 'software']
            };
            
            // Check if interest1 is a key in programmingKeywords
            for (const [key, keywords] of Object.entries(programmingKeywords)) {
                if (interest1.includes(key)) {
                    // Check if interest2 contains any of the related keywords
                    if (keywords.some(keyword => interest2.includes(keyword))) {
                        return true;
                    }
                }
                
                // Check the reverse as well
                if (interest2.includes(key)) {
                    if (keywords.some(keyword => interest1.includes(keyword))) {
                        return true;
                    }
                }
            }
            
            // Check if they share common words (for multi-word interests)
            const words1 = interest1.split(/\s+/);
            const words2 = interest2.split(/\s+/);
            
            // If they share significant words (excluding common words like "and", "for", etc.)
            const significantWords = ['programming', 'development', 'web', 'data', 'science', 'machine', 'learning', 'design', 'security'];
            
            for (const word of significantWords) {
                if (interest1.includes(word) && interest2.includes(word)) {
                    return true;
                }
            }
            
            return false;
        }
        
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
            
            // Get other user's specific interests (FOCUS ON SPECIFIC INTERESTS ONLY)
            const otherUserSpecificInterests = [];
            
            // Get specific interests (highest priority)
            if (userData.specificInterests) {
                Object.values(userData.specificInterests)
                    .filter(interest => typeof interest === 'string')
                    .forEach(interest => otherUserSpecificInterests.push(interest.toLowerCase()));
            }
            
            // Get main interest if available
            if (userData.mainInterest && typeof userData.mainInterest === 'string') {
                otherUserSpecificInterests.push(userData.mainInterest.toLowerCase());
            }
            
            // If no specific interests, check enrolled courses
            if (otherUserSpecificInterests.length === 0 && userData.enrolledCourses) {
                const enrolledCourses = Array.isArray(userData.enrolledCourses) 
                    ? userData.enrolledCourses 
                    : Object.values(userData.enrolledCourses);
                    
                enrolledCourses.forEach(course => {
                    if (course.title) otherUserSpecificInterests.push(course.title.toLowerCase());
                });
            }
            
            if (otherUserSpecificInterests.length === 0) {
                console.log(`User ${otherUserId} has no specific interests`);
                continue;
            }
            
            console.log(`User ${otherUserId} has specific interests:`, otherUserSpecificInterests);
            
            // Find matching interests using our enhanced similarity check
            const matchingInterests = [];
            
            userSpecificInterests.forEach(userInterest => {
                otherUserSpecificInterests.forEach(otherInterest => {
                    if (areSimilarInterests(userInterest, otherInterest)) {
                        // Store the actual interest that matched
                        matchingInterests.push({
                            userInterest,
                            otherInterest
                        });
                    }
                });
            });
            
            const similarityScore = matchingInterests.length;
            console.log(`Matching interests between ${userId} and ${otherUserId}:`, matchingInterests);
            
            // Only include users with at least one matching interest
            if (similarityScore > 0) {
                // Get user profile data
                const profile = userData.profile || {};
                
                // Prioritize finding the user's name from multiple sources
                let userName = 'User';
                if (profile.name) {
                    userName = profile.name;
                } else if (userData.email) {
                    // Extract name from email (e.g., john.doe@example.com -> John Doe)
                    const emailName = userData.email.split('@')[0].replace(/[._]/g, ' ');
                    userName = emailName.split(' ')
                        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(' ');
                } else if (userData.displayName) {
                    userName = userData.displayName;
                }
                
                const userProfilePic = profile.profilePic || 'https://via.placeholder.com/100';
                
                // Extract the actual matched interests for display
                const matchedInterestTitles = matchingInterests.map(match => match.otherInterest);
                
                potentialConnections.push({
                    userId: otherUserId,
                    name: userName,
                    profilePic: userProfilePic,
                    similarityScore,
                    matchingCourses: matchingInterests.length,
                    // Include the actual matching interests
                    matchingCourseTitles: matchedInterestTitles
                });
                
                console.log(`Added ${otherUserId} as potential connection with score ${similarityScore}`);
            } else {
                console.log(`No matching interests with user ${otherUserId}`);
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