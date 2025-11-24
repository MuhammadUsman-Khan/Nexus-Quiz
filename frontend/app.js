const API_BASE = 'http://localhost:8000/api';
let currentUser = null;
let currentSession = null;
let currentQuestion = null;
let userAnswers = [];

// Authentication Functions
async function loginUser(email, password) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Login failed');
        }
        
        const user = await response.json();
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        showUserInterface();
        loadDashboard();
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function registerUser(userData) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Registration failed');
        }
        
        showNotification('Registration successful! Please login.', 'success');
        showSection('login');
    } catch (error) {
        showNotification('Registration failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function showUserInterface() {
    showSection('dashboard');
    
    // Update navigation based on user role
    if (currentUser.role === 'admin') {
        document.getElementById('adminBtn').style.display = 'flex';
    } else {
        document.getElementById('adminBtn').style.display = 'none';
    }
    
    document.getElementById('userName').textContent = currentUser.name;
    updateNavigation('dashboard');
}

// Quiz Functions
async function startNewQuiz() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/quiz/start`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-email': currentUser.email 
            },
            body: JSON.stringify({
                user_id: currentUser.email,
                previous_score: getPreviousScore() || 0,
                questions: []
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to start quiz');
        }
        
        const quizData = await response.json();
        currentSession = {
            id: quizData.session_id,
            questionsAnswered: quizData.questions_answered || 0,
            correctAnswers: quizData.correct_answers || 0,
            currentDifficulty: quizData.difficulty,
            totalQuestions: 10
        };
        
        userAnswers = []; // Reset answers array
        showSection('quiz');
        updateNavigation('quiz');
        loadQuestion(quizData.question);
        
    } catch (error) {
        showNotification('Failed to start quiz: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function loadQuestion(question) {
    currentQuestion = question;
    document.getElementById('questionText').textContent = question.question_text;
    document.getElementById('currentDifficulty').textContent = question.difficulty;
    
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionElement = document.createElement('button');
        optionElement.className = 'option-btn';
        optionElement.textContent = option;
        optionElement.onclick = () => selectOption(optionElement, option);
        optionsContainer.appendChild(optionElement);
    });
    
    updateQuizProgress();
}

function selectOption(optionElement, option) {
    document.querySelectorAll('.option-btn').forEach(opt => {
        opt.classList.remove('selected');
    });
    optionElement.classList.add('selected');
    currentQuestion.userAnswer = option;
}

async function submitAnswer() {
    if (!currentQuestion || !currentQuestion.userAnswer) {
        showNotification('Please select an answer', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        // Store the answer
        userAnswers.push({
            id: currentQuestion.id,
            user_answer: currentQuestion.userAnswer
        });
        
        // Submit the answer to get grading
        const gradeResponse = await fetch(`${API_BASE}/quiz/submit-answer`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-email': currentUser.email 
            },
            body: JSON.stringify({
                session_id: currentSession.id,
                question_id: currentQuestion.id,
                user_answer: currentQuestion.userAnswer
            })
        });
        
        if (!gradeResponse.ok) {
            const errorData = await gradeResponse.json();
            throw new Error(errorData.detail || 'Failed to submit answer');
        }
        
        const gradeResult = await gradeResponse.json();
        
        // Show immediate feedback
        showAnswerFeedback(gradeResult);
        
        // Update session stats immediately
        currentSession.questionsAnswered++;
        if (gradeResult.is_correct) {
            currentSession.correctAnswers++;
        }
        
        // Check if this was the last question
        if (currentSession.questionsAnswered >= currentSession.totalQuestions) {
            // Wait a moment then submit the complete quiz
            setTimeout(async () => {
                // Hide feedback modal
                const feedbackModal = document.getElementById('feedbackModal');
                if (feedbackModal) {
                    feedbackModal.style.display = 'none';
                }
                await submitCompleteQuiz();
            }, 2000);
        } else {
            // Wait a moment then get next question
            setTimeout(async () => {
                await getNextQuestion(gradeResult.score);
            }, 2000);
        }
        
    } catch (error) {
        showNotification('Failed to submit answer: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function showAnswerFeedback(gradeResult, isLastQuestion = false) {
    const isCorrect = gradeResult.is_correct;
    const message = isCorrect ? '✅ Correct! Well done!' : '❌ Incorrect. Better luck next time!';
    
    // Create or show feedback modal
    let feedbackModal = document.getElementById('feedbackModal');
    if (!feedbackModal) {
        feedbackModal = document.createElement('div');
        feedbackModal.id = 'feedbackModal';
        feedbackModal.className = 'feedback-modal';
        document.body.appendChild(feedbackModal);
    }
    
    const loadingText = isLastQuestion 
        ? 'Quiz completed! Calculating results...'
        : 'Loading next question...';
    
    feedbackModal.innerHTML = `
        <div class="feedback-content glass-card">
            <div class="feedback-icon ${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '🎉' : '💡'}
            </div>
            <h3>${isCorrect ? 'Correct!' : 'Incorrect'}</h3>
            <p>${gradeResult.message}</p>
            ${!isCorrect ? `<p class="correct-answer">Correct answer: ${gradeResult.correct_answer}</p>` : ''}
            <p class="loading-text">${loadingText}</p>
        </div>
    `;
    
    feedbackModal.style.display = 'flex';
}
async function getNextQuestion(previousScore) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/quiz/next-question`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-email': currentUser.email 
            },
            body: JSON.stringify({
                session_id: currentSession.id,
                previous_score: previousScore
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to get next question');
        }
        
        const nextData = await response.json();
        
        // Hide feedback modal
        const feedbackModal = document.getElementById('feedbackModal');
        if (feedbackModal) {
            feedbackModal.style.display = 'none';
        }
        
        // Check if quiz is completed
        if (nextData.session_completed) {
            await submitCompleteQuiz();
        } else {
            // Update session and load next question
            currentSession.questionsAnswered = nextData.questions_answered;
            currentSession.correctAnswers = nextData.correct_answers;
            currentSession.currentDifficulty = nextData.difficulty;
            
            loadQuestion(nextData.question);
        }
        
    } catch (error) {
        // If we can't get the next question, end the quiz
        console.error('Error getting next question:', error);
        showNotification('Quiz completed!', 'success');
        await submitCompleteQuiz();
    } finally {
        showLoading(false);
    }
}

// CORRECTED QUIZ COMPLETION FUNCTIONS
async function submitCompleteQuiz() {
    try {
        showLoading(true);
        
        // Calculate final score locally first
        const finalScore = currentSession.questionsAnswered > 0 
            ? Math.round((currentSession.correctAnswers / currentSession.questionsAnswered) * 100)
            : 0;
        
        // Try to submit to backend
        const response = await fetch(`${API_BASE}/quiz/submit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-email': currentUser.email 
            },
            body: JSON.stringify({
                user_id: currentUser.email,
                previous_score: getPreviousScore() || 0,
                questions: userAnswers
            })
        });
        
        let finalData;
        
        if (response.ok) {
            finalData = await response.json();
        } else {
            // If backend fails, create final data locally
            console.log('Backend submission failed, using local results');
            finalData = {
                total_score: finalScore,
                results: userAnswers,
                questions_answered: currentSession.questionsAnswered,
                correct_answers: currentSession.correctAnswers,
                feedback: getCompletionFeedback(finalScore),
                next_difficulty: calculateNextDifficulty(finalScore),
                difficulty: currentSession.currentDifficulty
            };
        }
        
        showFinalResults(finalData);
        
    } catch (error) {
        console.error('Quiz submission error:', error);
        // Final fallback - create results locally
        const finalScore = currentSession.questionsAnswered > 0 
            ? Math.round((currentSession.correctAnswers / currentSession.questionsAnswered) * 100)
            : 0;
        
        const finalData = {
            total_score: finalScore,
            results: userAnswers,
            questions_answered: currentSession.questionsAnswered,
            correct_answers: currentSession.correctAnswers,
            feedback: getCompletionFeedback(finalScore),
            next_difficulty: calculateNextDifficulty(finalScore),
            difficulty: currentSession.currentDifficulty
        };
        
        showFinalResults(finalData);
        showNotification('Quiz completed with local results', 'info');
    } finally {
        showLoading(false);
    }
}

// Helper functions for quiz completion
function getCompletionFeedback(score) {
    if (score >= 90) return "Outstanding performance! You've mastered this level!";
    if (score >= 80) return "Excellent work! You're doing great!";
    if (score >= 70) return "Good job! You're making solid progress.";
    if (score >= 60) return "Not bad! Keep practicing to improve.";
    return "Don't give up! Review the material and try again.";
}

function calculateNextDifficulty(score) {
    if (score >= 85) return "hard";
    if (score >= 70) return "medium";
    return "easy";
}

function updateQuizProgress() {
    const currentQuestionNumber = currentSession.questionsAnswered + 1;
    const progressPercent = (currentQuestionNumber / currentSession.totalQuestions) * 100;
    
    document.getElementById('currentQuestion').textContent = `${currentQuestionNumber}/${currentSession.totalQuestions}`;
    document.getElementById('currentScore').textContent = currentSession.correctAnswers * 100;
    
    // Update progress bar if exists
    const progressBar = document.querySelector('.quiz-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }
}

function showFinalResults(finalData) {
    // Use the new data structure with proper fallbacks
    const totalScore = finalData.total_score || 0;
    const questionsAnswered = finalData.questions_answered || finalData.results?.length || 0;
    const correctAnswers = finalData.correct_answers || (finalData.results ? finalData.results.filter(r => r.is_correct).length : 0);
    const accuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered * 100) : 0;
    
    document.getElementById('finalScoreDisplay').textContent = totalScore.toFixed(0);
    document.getElementById('totalQuestions').textContent = questionsAnswered;
    document.getElementById('correctAnswers').textContent = correctAnswers;
    document.getElementById('accuracyRate').textContent = accuracy.toFixed(1) + '%';
    document.getElementById('nextDifficulty').textContent = finalData.next_difficulty || 'easy';
    document.getElementById('feedback').textContent = finalData.feedback || 'Quiz completed!';
    
    // Update results subtitle with quiz info
    document.getElementById('resultsSubtitle').textContent = 
        `You've completed the ${finalData.difficulty || 'adaptive'} quiz`;
    
    showSection('results');
    updateNavigation('results');
    
    // Reset session
    currentSession = null;
    currentQuestion = null;
    userAnswers = [];
    
    // Reload dashboard to update stats
    loadDashboard();
}

async function endQuizEarly() {
    if (!currentSession) {
        showNotification('No quiz in progress', 'warning');
        return;
    }
    
    if (!confirm('Are you sure you want to end the quiz early? Your progress will be saved.')) {
        return;
    }
    
    try {
        showLoading(true);
        await submitCompleteQuiz();
    } catch (error) {
        showNotification('Failed to end quiz: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Dashboard Functions
async function loadDashboard() {
    try {
        // Load user results for dashboard stats
        const response = await fetch(`${API_BASE}/results/user/${currentUser.email}`);
        if (response.ok) {
            const results = await response.json();
            updateDashboardStats(results);
        }
        
        // Load user profile
        const userResponse = await fetch(`${API_BASE}/users/${currentUser.email}`);
        if (userResponse.ok) {
            const userData = await userResponse.json();
            updateUserProfile(userData);
        }
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateDashboardStats(results) {
    if (results.length === 0) {
        // Set default values for new users
        document.getElementById('totalPoints').textContent = '0';
        document.getElementById('quizzesCompleted').textContent = '0';
        document.getElementById('averageScore').textContent = '0%';
        document.getElementById('currentStreak').textContent = '0';
        
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressPercent').textContent = '0%';
        document.getElementById('completedModules').textContent = '0';
        return;
    }
    
    // Calculate stats
    const totalPoints = results.reduce((sum, result) => sum + (result.total_score || 0), 0);
    const quizzesCompleted = results.length;
    const averageScore = results.reduce((sum, result) => sum + (result.total_score || 0), 0) / results.length;
    
    // Calculate streak (consecutive quizzes with score >= 70)
    let currentStreak = 0;
    const sortedResults = results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    for (let result of sortedResults) {
        if (result.total_score >= 70) {
            currentStreak++;
        } else {
            break;
        }
    }
    
    // Update dashboard
    document.getElementById('totalPoints').textContent = Math.round(totalPoints);
    document.getElementById('quizzesCompleted').textContent = quizzesCompleted;
    document.getElementById('averageScore').textContent = averageScore.toFixed(1) + '%';
    document.getElementById('currentStreak').textContent = currentStreak;
    
    // Update progress (assuming 30 modules total for progression)
    const progressPercent = Math.min((quizzesCompleted / 30) * 100, 100);
    document.getElementById('progressFill').style.width = `${progressPercent}%`;
    document.getElementById('progressPercent').textContent = `${progressPercent.toFixed(0)}%`;
    document.getElementById('completedModules').textContent = quizzesCompleted;
    document.getElementById('totalModules').textContent = '30';
}

function updateUserProfile(userData) {
    // Update any user-specific profile information
    if (userData.role === 'admin') {
        document.getElementById('userName').innerHTML += ' <span class="admin-badge">👑 Admin</span>';
    }
}

function getPreviousScore() {
    // Get the user's last score from localStorage or recent results
    const lastResult = JSON.parse(localStorage.getItem('lastQuizResult'));
    return lastResult ? lastResult.total_score : 0;
}

// Admin Functions
async function showQuestionManager() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/questions/all`, {
            headers: { 'x-user-email': currentUser.email }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load questions');
        }
        
        const questions = await response.json();
        displayQuestions(questions);
        
        // Show the question manager section
        document.getElementById('questionManager').style.display = 'block';
        
    } catch (error) {
        showNotification('Failed to load questions: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayQuestions(questions) {
    const container = document.getElementById('questionsList');
    container.innerHTML = '';
    
    if (questions.length === 0) {
        container.innerHTML = '<p class="no-questions">No questions found. Import some questions to get started.</p>';
        return;
    }
    
    questions.forEach(question => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question-item glass-card';
        questionElement.innerHTML = `
            <div class="question-header">
                <h4>${question.question_text}</h4>
                <span class="difficulty-badge difficulty-${question.difficulty}">${question.difficulty}</span>
            </div>
            <div class="question-details">
                <p><strong>Options:</strong> ${question.options.join(', ')}</p>
                <p><strong>Correct Answer:</strong> ${question.correct_answer}</p>
            </div>
            <div class="question-actions">
                <button class="btn btn-danger btn-small" onclick="deleteQuestion('${question.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        container.appendChild(questionElement);
    });
}

async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/questions/${questionId}`, {
            method: 'DELETE',
            headers: { 'x-user-email': currentUser.email }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete question');
        }
        
        showNotification('Question deleted successfully!', 'success');
        showQuestionManager(); // Refresh the list
        
    } catch (error) {
        showNotification('Failed to delete question: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function importFromAPI() {
    if (!confirm('This will import 50 computer science questions from Open Trivia DB. Continue?')) return;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/questions/import-from-api`, {
            method: 'POST',
            headers: { 'x-user-email': currentUser.email }
        });
        
        if (!response.ok) {
            throw new Error('Failed to import from API');
        }
        
        const result = await response.json();
        showNotification(`Successfully imported ${result.imported} questions!`, 'success');
        
        // Refresh questions list if manager is open
        if (document.getElementById('questionManager').style.display === 'block') {
            showQuestionManager();
        }
        
    } catch (error) {
        showNotification('Failed to import questions: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function showSystemStats() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/results/all`, {
            headers: { 'x-user-email': currentUser.email }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load system statistics');
        }
        
        const allResults = await response.json();
        displaySystemStats(allResults);
        
    } catch (error) {
        showNotification('Failed to load system statistics: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displaySystemStats(allResults) {
    // Calculate system statistics
    const totalQuizzes = allResults.length;
    const totalUsers = [...new Set(allResults.map(r => r.user_id))].length;
    const averageSystemScore = allResults.reduce((sum, result) => sum + (result.total_score || 0), 0) / totalQuizzes;
    
    // Show in a modal or dedicated section
    const statsHTML = `
        <div class="system-stats">
            <div class="stat-item">
                <h3>Total Quizzes Taken</h3>
                <p class="stat-value">${totalQuizzes}</p>
            </div>
            <div class="stat-item">
                <h3>Active Users</h3>
                <p class="stat-value">${totalUsers}</p>
            </div>
            <div class="stat-item">
                <h3>System Average Score</h3>
                <p class="stat-value">${averageSystemScore.toFixed(1)}%</p>
            </div>
        </div>
    `;
    
    // You can implement a modal here to display these stats
    showNotification(`System Stats: ${totalQuizzes} quizzes, ${totalUsers} users, ${averageSystemScore.toFixed(1)}% avg score`, 'info');
}

// Utility Functions
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    // Special handling for admin section
    if (sectionId === 'admin') {
        document.getElementById('questionManager').style.display = 'none';
    }
}

function updateNavigation(activeSection) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the corresponding nav button
    const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => {
        return btn.textContent.toLowerCase().includes(activeSection) || 
               (activeSection === 'dashboard' && btn.textContent.toLowerCase().includes('home'));
    });
    
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function logout() {
    currentUser = null;
    currentSession = null;
    currentQuestion = null;
    userAnswers = [];
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastQuizResult');
    showSection('login');
    updateNavigation('login');
    
    showNotification('Logged out successfully', 'success');
}

function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (!loader) {
        // Create loader if it doesn't exist
        const loaderHTML = `
            <div id="loadingOverlay" class="loading-overlay" style="display: none;">
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loaderHTML);
    }
    
    if (show) {
        document.getElementById('loadingOverlay').style.display = 'flex';
        document.body.style.cursor = 'wait';
    } else {
        document.getElementById('loadingOverlay').style.display = 'none';
        document.body.style.cursor = 'default';
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content glass-card">
            <span class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Create advanced particles
function createParticles() {
    const particlesContainer = document.getElementById('particles-container');
    if (!particlesContainer) return;
    
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const size = Math.random() * 4 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.left = `${Math.random() * 100}%`;
        
        const duration = Math.random() * 20 + 20;
        particle.style.animationDuration = `${duration}s`;
        
        const delay = Math.random() * 5;
        particle.style.animationDelay = `${delay}s`;
        
        particlesContainer.appendChild(particle);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showUserInterface();
            loadDashboard();
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
            showSection('login');
        }
    } else {
        showSection('login');
    }
    
    // Create particles
    createParticles();
    
    // Add parallax effect
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.animated-bg, .grid-overlay');
        
        parallaxElements.forEach(el => {
            const speed = 0.5;
            el.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await loginUser(email, password);
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                name: document.getElementById('registerName').value,
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value,
                role: document.getElementById('registerRole').value
            };
            await registerUser(userData);
        });
    }
});

// Add these CSS styles to your styles.css for the new components
const additionalStyles = `
/* Feedback Modal */
.feedback-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.feedback-content {
    text-align: center;
    padding: 40px;
    max-width: 400px;
}

.feedback-icon {
    font-size: 4rem;
    margin-bottom: 20px;
}

.feedback-icon.correct {
    color: var(--success-glow);
}

.feedback-icon.incorrect {
    color: var(--warning-glow);
}

.correct-answer {
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 8px;
    margin: 15px 0;
}

.loading-text {
    color: var(--text-secondary);
    font-style: italic;
}

/* Notifications */
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1001;
    animation: slideInRight 0.3s ease;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 20px;
    min-width: 300px;
}

.notification-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    margin-left: auto;
}

/* Question Items */
.question-item {
    margin-bottom: 20px;
    padding: 20px;
}

.question-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
}

.question-header h4 {
    margin: 0;
    flex: 1;
    margin-right: 15px;
}

.difficulty-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
}

.difficulty-easy {
    background: var(--success-glow);
    color: #000;
}

.difficulty-medium {
    background: var(--warning-glow);
    color: #000;
}

.difficulty-hard {
    background: var(--danger-glow);
    color: #fff;
}

.question-details {
    margin-bottom: 15px;
}

.question-actions {
    display: flex;
    justify-content: flex-end;
}

.btn-small {
    padding: 8px 16px;
    font-size: 14px;
}

.btn-danger {
    background: var(--danger-glow);
    color: white;
}

/* Loading Overlay */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 999;
}

.loading-content {
    text-align: center;
    color: white;
}

.loading-spinner {
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid var(--primary);
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.admin-badge {
    background: var(--accent);
    color: #000;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    margin-left: 8px;
}

.no-questions {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary);
}

.system-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 30px;
}

.stat-item {
    text-align: center;
    padding: 20px;
}

.stat-item h3 {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--primary);
}
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);