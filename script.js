/* ============================================
   Karen Safo-Barnieh — Site Script
   ============================================ */

// --- Intro Loader ---
const introLoader = document.getElementById('introLoader');
if (introLoader) {
    window.setTimeout(() => {
        introLoader.classList.add('is-hidden');
    }, 1600);
}

// --- Reveal on Scroll ---
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            const parent = entry.target.closest('section, footer');
            const siblings = parent ? parent.querySelectorAll('.reveal') : [];
            const siblingIndex = Array.from(siblings).indexOf(entry.target);
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, siblingIndex * 80);
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// --- Hero: reveal immediately on load ---
window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.hero .reveal, .page-hero .reveal').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), 150 + i * 120);
    });
});

// --- Navigation Scroll Effect ---
const nav = document.getElementById('nav');
let navTicking = false;
window.addEventListener('scroll', () => {
    if (!navTicking) {
        requestAnimationFrame(() => {
            nav.classList.toggle('scrolled', window.scrollY > 50);
            navTicking = false;
        });
        navTicking = true;
    }
});

// --- Mobile Navigation Toggle ---
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
    });
});

// --- FAQ Accordion ---
document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(other => other.classList.remove('active'));
        if (!isActive) item.classList.add('active');
    });
});

// --- Contact Form ---
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(contactForm);
        const name = formData.get('name') || '';
        const email = formData.get('email') || '';
        const service = formData.get('service') || 'Not specified';
        const message = formData.get('message') || '';
        const subject = encodeURIComponent('New enquiry from karensafo.com');
        const body = encodeURIComponent(
            `Name: ${name}\nEmail: ${email}\nService needed: ${service}\n\nMessage:\n${message}`
        );

        window.location.href = `mailto:legal@karensafo.com?subject=${subject}&body=${body}`;
    });
}

// --- Smooth scroll for anchor links ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const top = target.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// --- Accolade number counting animation ---
function animateCount(el, end, duration) {
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(end * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const count = parseInt(el.dataset.count);
            if (!isNaN(count)) {
                el.textContent = '0';
                setTimeout(() => animateCount(el, count, 1600), 300);
            }
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.accolade-number[data-count]').forEach(el => counterObserver.observe(el));
