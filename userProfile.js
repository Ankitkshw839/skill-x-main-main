import { getCurrentUser, saveUserProfile, getUserProfile, handleLogout } from './auth.js';
import { getUserCourses } from './communityService.js';

// Initialize the user profile page
export async function initProfilePage() {
    try {
        const user = await getCurrentUser();
        
        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return;
        }
        
        // Set up logout button functionality
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        } else {
            console.error('Logout button not found in profile page');
        }
        
        // Load user profile data
        const profileData = await getUserProfile(user.uid);
        const userCourses = await getUserCourses(user.uid);
        
        // Set profile picture from Google account if available
        const profilePicElement = document.getElementById('profile-pic');
        if (profilePicElement) {
            // First try to use photoURL from Firebase auth (from Google login)
            if (user.photoURL) {
                profilePicElement.src = user.photoURL;
                
                // Also save the photoURL to the user's profile if not already saved
                if (!profileData?.profilePic) {
                    await saveUserProfile(user.uid, {
                        profilePic: user.photoURL
                    });
                }
            } 
            // If no photoURL but we have one in the profile, use that
            else if (profileData?.profilePic) {
                profilePicElement.src = profileData.profilePic;
            }
            // Otherwise use placeholder
            else {
                profilePicElement.src = 'https://via.placeholder.com/150';
            }
        }
        
        // Update profile header with user's name
        const profileHeaderTitle = document.querySelector('.profile-header h1');
        if (profileHeaderTitle) {
            const userName = profileData?.name || user.displayName || 'User';
            profileHeaderTitle.textContent = `${userName}'s Profile`;
        }
        
        // Populate profile form with existing data
        populateProfileForm(profileData || {});
        
        // Pre-fill email from Google account if available and not already set
        const emailInput = document.querySelector('#email');
        if (emailInput && user.email && !emailInput.value) {
            emailInput.value = user.email;
        }
        
        // Pre-fill name from Google account if available and not already set
        const nameInput = document.querySelector('#name');
        if (nameInput && user.displayName && !nameInput.value) {
            nameInput.value = user.displayName;
        }
        
        // Display user courses
        displayUserCourses(userCourses || []);
        
        // Set up form submission handler
        setupProfileFormSubmission(user.uid);
        
        // Set up profile picture upload
        setupProfilePictureUpload(user.uid);
        
    } catch (error) {
        console.error("Error initializing profile page:", error);
        showErrorMessage("Failed to load profile data. Please try again later.");
    }
}

// Populate the profile form with existing data
function populateProfileForm(profileData) {
    const form = document.getElementById('profile-form');
    
    if (!form) return;
    
    // Set form field values
    if (profileData.name) {
        form.querySelector('#name').value = profileData.name;
    }
    
    if (profileData.email) {
        form.querySelector('#email').value = profileData.email;
    }
    
    if (profileData.phone) {
        form.querySelector('#phone').value = profileData.phone;
    }
    
    if (profileData.dob) {
        form.querySelector('#dob').value = profileData.dob;
    }
    
    if (profileData.bio) {
        form.querySelector('#bio').value = profileData.bio;
    }
    
    if (profileData.interests) {
        form.querySelector('#interests').value = profileData.interests.join(', ');
    }
    
    // Note: Profile picture is now handled in initProfilePage
}

// Display user's enrolled courses
function displayUserCourses(courses) {
    const coursesContainer = document.getElementById('user-courses');
    
    if (!coursesContainer) return;
    
    if (courses.length === 0) {
        coursesContainer.innerHTML = `
            <div class="empty-courses">
                <p>You haven't enrolled in any courses yet.</p>
                <a href="courses.html" class="btn btn-primary">Browse Courses</a>
            </div>
        `;
        return;
    }
    
    let html = '<div class="courses-grid">';
    
    courses.forEach(course => {
        html += `
            <div class="course-card">
                <div class="course-image">
                    <img src="${course.imageUrl || 'https://via.placeholder.com/300x200'}" alt="${course.title}">
                </div>
                <div class="course-content">
                    <h3>${course.title}</h3>
                    <p class="course-difficulty">${course.difficulty}</p>
                    <p class="course-duration">${course.duration} weeks</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    coursesContainer.innerHTML = html;
}

// Set up profile form submission
function setupProfileFormSubmission(userId) {
    const form = document.getElementById('profile-form');
    
    if (!form) return;
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
        
        try {
            // Get form data
            const name = form.querySelector('#name').value.trim();
            const email = form.querySelector('#email').value.trim();
            const phone = form.querySelector('#phone').value.trim();
            const dob = form.querySelector('#dob').value.trim();
            const bio = form.querySelector('#bio').value.trim();
            const interestsString = form.querySelector('#interests').value.trim();
            const interests = interestsString ? interestsString.split(',').map(i => i.trim()) : [];
            
            // Get profile pic from file input if available
            const profilePicInput = form.querySelector('#profile-pic-upload');
            let profilePicUrl = null;
            
            if (profilePicInput && profilePicInput.files.length > 0) {
                // In a real implementation, you would upload the file to storage
                // and get the URL. For now, we'll just use a placeholder.
                profilePicUrl = 'https://via.placeholder.com/150';
                
                // TODO: Implement file upload to Firebase Storage
                // const file = profilePicInput.files[0];
                // profilePicUrl = await uploadProfilePicture(userId, file);
            }
            
            // Prepare profile data
            const profileData = {
                name,
                email,
                phone,
                dob,
                bio,
                interests
            };
            
            // Only add profile pic URL if a new one was uploaded
            if (profilePicUrl) {
                profileData.profilePic = profilePicUrl;
            }
            
            // Save to Firebase
            await saveUserProfile(userId, profileData);
            
            // Show success message
            showSuccessMessage("Profile updated successfully!");
            
        } catch (error) {
            console.error("Error saving profile:", error);
            showErrorMessage("Failed to update profile. Please try again.");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Profile';
        }
    });
}

// Set up profile picture upload
function setupProfilePictureUpload(userId) {
    const profilePicInput = document.getElementById('profile-pic-upload');
    const profilePicElement = document.getElementById('profile-pic');
    
    if (!profilePicInput || !profilePicElement) return;
    
    profilePicInput.addEventListener('change', async (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            
            // Simple client-side validation
            if (!file.type.match('image.*')) {
                showErrorMessage("Please select an image file");
                return;
            }
            
            try {
                // Create a temporary URL for the selected image
                const tempUrl = URL.createObjectURL(file);
                profilePicElement.src = tempUrl;
                
                // In a real implementation, you would upload the file to Firebase Storage
                // For now, we'll just use a placeholder URL
                const profilePicUrl = 'https://via.placeholder.com/150';
                
                // TODO: Implement file upload to Firebase Storage
                // const profilePicUrl = await uploadProfilePicture(userId, file);
                
                // Save the profile picture URL to the user's profile
                await saveUserProfile(userId, {
                    profilePic: profilePicUrl
                });
                
                showSuccessMessage("Profile picture updated!");
            } catch (error) {
                console.error("Error updating profile picture:", error);
                showErrorMessage("Failed to update profile picture");
                
                // Reset to previous picture or placeholder
                profilePicElement.src = 'https://via.placeholder.com/150';
            }
        }
    });
}

// Show success message
function showSuccessMessage(message) {
    const messageContainer = document.getElementById('profile-message');
    
    if (!messageContainer) return;
    
    messageContainer.innerHTML = `
        <div class="alert alert-success">
            ${message}
        </div>
    `;
    
    // Clear message after 3 seconds
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 3000);
}

// Show error message
function showErrorMessage(message) {
    const messageContainer = document.getElementById('profile-message');
    
    if (!messageContainer) return;
    
    messageContainer.innerHTML = `
        <div class="alert alert-danger">
            ${message}
        </div>
    `;
} 