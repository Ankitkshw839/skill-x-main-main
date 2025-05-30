// Course Enrollment Module
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { auth } from './auth.js';

const database = getDatabase();

// Function to enroll in a course
export async function enrollInCourse(courseId, courseData) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User must be logged in to enroll');
        }

        const enrollmentData = {
            userId: user.uid,
            courseId: courseId,
            enrollmentDate: new Date().toISOString(),
            progress: 0,
            status: 'enrolled',
            ...courseData
        };

        // First, get the current user data to preserve recommendations
        const userRef = ref(database, `users/${user.uid}`);
        const userDataSnapshot = await get(userRef);
        let userData = {};
        
        if (userDataSnapshot.exists()) {
            userData = userDataSnapshot.val();
            console.log('Retrieved existing user data:', userData);
        }
        
        // Preserve recommendedCourses if they exist
        const recommendedCourses = userData.recommendedCourses || [];
        
        // Add to user's enrollments
        await set(ref(database, `enrollments/${user.uid}/${courseId}`), enrollmentData);

        // Also add to the new location to ensure all enrolled courses are visible
        let enrolledCourses = [];
        
        if (userData.enrolledCourses) {
            if (Array.isArray(userData.enrolledCourses)) {
                enrolledCourses = userData.enrolledCourses;
            } else {
                enrolledCourses = Object.values(userData.enrolledCourses);
            }
        }
        
        // Check if course is already enrolled to avoid duplicates
        const courseExists = enrolledCourses.some(course => 
            course.courseId === courseId || 
            (course.title && courseData.title && course.title === courseData.title));
            
        if (!courseExists) {
            enrolledCourses.push(enrollmentData);
        }
        
        // Update the user data with both enrolled courses and recommended courses
        const updatedUserData = {
            ...userData,
            enrolledCourses: enrolledCourses,
            recommendedCourses: recommendedCourses
        };
        
        console.log('Saving updated user data:', updatedUserData);
        await set(userRef, updatedUserData);

        // Update course enrollment count
        const courseRef = ref(database, `courses/${courseId}/enrollmentCount`);
        const snapshot = await get(courseRef);
        const currentCount = snapshot.exists() ? snapshot.val() : 0;
        await set(courseRef, currentCount + 1);

        return enrollmentData;
    } catch (error) {
        console.error("Error enrolling in course:", error);
        throw error;
    }
}

// Function to get user's enrolled courses
export async function getEnrolledCourses() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("getEnrolledCourses: No user logged in");
            throw new Error('User must be logged in to get enrolled courses');
        }

        console.log("getEnrolledCourses: Looking for courses for user", user.uid);

        // First check the new location (users/[uid]/enrolledCourses)
        const userEnrolledCoursesRef = ref(database, `users/${user.uid}/enrolledCourses`);
        console.log("getEnrolledCourses: Checking path", `users/${user.uid}/enrolledCourses`);
        
        const userSnapshot = await get(userEnrolledCoursesRef);
        
        if (userSnapshot.exists()) {
            const enrolledCourses = userSnapshot.val();
            console.log("getEnrolledCourses: Found data at new location:", enrolledCourses);
            
            if (Array.isArray(enrolledCourses)) {
                console.log(`getEnrolledCourses: Returning ${enrolledCourses.length} courses`);
                return enrolledCourses;
            } else {
                console.log("getEnrolledCourses: Data exists but is not an array, converting to array");
                return Object.values(enrolledCourses);
            }
        } else {
            console.log("getEnrolledCourses: No data at new location, checking old location");
        }
        
        // Fall back to the old location
        const enrollmentsRef = ref(database, `enrollments/${user.uid}`);
        console.log("getEnrolledCourses: Checking path", `enrollments/${user.uid}`);
        
        const snapshot = await get(enrollmentsRef);

        if (!snapshot.exists()) {
            console.log("getEnrolledCourses: No data at old location either, returning empty array");
            return [];
        }

        const enrollments = snapshot.val();
        console.log("getEnrolledCourses: Found data at old location:", enrollments);
        return Object.values(enrollments);
    } catch (error) {
        console.error("Error getting enrolled courses:", error);
        return []; // Return empty array on error instead of throwing
    }
}

// Function to update course progress
export async function updateCourseProgress(courseId, progress) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User must be logged in to update progress');
        }

        // First check if course is in the new location
        const userEnrolledCoursesRef = ref(database, `users/${user.uid}/enrolledCourses`);
        const userSnapshot = await get(userEnrolledCoursesRef);
        
        if (userSnapshot.exists()) {
            const enrolledCourses = userSnapshot.val();
            if (Array.isArray(enrolledCourses)) {
                // Find the course by title or ID
                const courseIndex = enrolledCourses.findIndex(c => 
                    c.title === courseId || c.courseId === courseId);
                
                if (courseIndex >= 0) {
                    // Update the progress
                    enrolledCourses[courseIndex].progress = progress;
                    // Save the updated array
                    await set(userEnrolledCoursesRef, enrolledCourses);
                    return progress;
                }
            }
        }

        // Fall back to the old location
        await set(ref(database, `enrollments/${user.uid}/${courseId}/progress`), progress);
        return progress;
    } catch (error) {
        console.error("Error updating course progress:", error);
        throw error;
    }
}
