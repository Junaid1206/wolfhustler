document.addEventListener("DOMContentLoaded", () => {
    // === 1. HAMBURGER MOBILE MENU LOGIC ===
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');

    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu if a user clicks any linking item anchor
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }


    // === 2. PREMIUM PRODUCT CAROUSEL LOGIC ===
    const track = document.getElementById('carousel-track');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const cards = document.querySelectorAll('.product-card');
    
    if (track && nextBtn && prevBtn && cards.length > 0) {
        let index = 0;
        const gap = 20; // Exact margin space locked inside CSS
        let cardsVisible = getVisibleCardsCount();
        let maxIndex = cards.length - cardsVisible;

        function getVisibleCardsCount() {
            if (window.innerWidth <= 650) return 1;
            if (window.innerWidth <= 1100) return 2;
            return 3;
        }

        function moveCarousel() {
            const cardWidth = cards[0].getBoundingClientRect().width;
            // Accurate math sliding positioning calculation
            const amountToMove = index * (cardWidth + gap);
            track.style.transform = `translateX(-${amountToMove}px)`;
        }

        // Next Action Event Trigger
        function handleNext() {
            if (index < maxIndex) {
                index++;
            } else {
                index = 0; // Seamless loop reset back to card 1
            }
            moveCarousel();
        }

        // Prev Action Event Trigger
        function handlePrev() {
            if (index > 0) {
                index--;
            } else {
                index = maxIndex; // Jump loop straight to end cards
            }
            moveCarousel();
        }

        nextBtn.addEventListener('click', handleNext);
        prevBtn.addEventListener('click', handlePrev);

        // AUTOMATIC RUNNING LOOP SETUP (Interval locked at 3.5s)
        let autoSlideInterval = setInterval(handleNext, 3500);

        // PAUSE TRACK ON MOUSE HOVER OVER CAROUSEL SIDE
        const carouselSide = document.querySelector('.picks-carousel-side');
        if (carouselSide) {
            carouselSide.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
            carouselSide.addEventListener('mouseleave', () => {
                autoSlideInterval = setInterval(handleNext, 3500);
            });
        }

        // Handle dynamically changing browser dimensions smoothly
        window.addEventListener('resize', () => {
            cardsVisible = getVisibleCardsCount();
            maxIndex = cards.length - cardsVisible;
            if (index > maxIndex) index = maxIndex;
            moveCarousel();
        });
    }
});