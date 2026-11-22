/* Responsive wizard: only new reservations on narrow screens.
   Existing reservations and support consultations retain all visible fields. */
const form = document.querySelector('#reservaForm');
const steps = [...document.querySelectorAll('[data-reservation-step]')];
const indicators = [...document.querySelectorAll('[data-step-indicator]')];
const nextButton = document.querySelector('#reservationWizardNext');
const backButton = document.querySelector('#reservationWizardBack');
const submitButton = form?.querySelector('button[type="submit"]');
const cancelLink = document.querySelector('#reservationCancel');
const status = document.querySelector('#reservationWizardStatus');
const compact = window.matchMedia('(max-width: 839px)');
const editingExisting = new URLSearchParams(window.location.search).has('id');
let activeStep = 0;

function wizardEnabled() {
  return Boolean(form && steps.length === 3 && compact.matches && !editingExisting);
}
function showStep() {
  const active = wizardEnabled();
  form?.classList.toggle('is-wizard-enabled', active);
  steps.forEach((step, index) => {
    step.hidden = active && index !== activeStep;
  });
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', active && index === activeStep);
    indicator.classList.toggle('is-done', active && index < activeStep);
  });
  if (status) status.hidden = !active;
  if (status && active) status.textContent = 'Paso ' + (activeStep + 1) + ' de 3';
  if (backButton) backButton.hidden = !active || activeStep === 0;
  if (nextButton) nextButton.hidden = !active || activeStep === steps.length - 1;
  if (submitButton) submitButton.hidden = active && activeStep !== steps.length - 1;
  if (cancelLink) cancelLink.hidden = active && activeStep !== 0;
}
function validateCurrentStep() {
  const panel = steps[activeStep];
  for (const control of panel.querySelectorAll('input,select,textarea')) {
    if (control.disabled || control.closest('[hidden]')) continue;
    if (!control.checkValidity()) {
      // Material 3 conserva los controles originales ocultos. En iOS enfocar
      // el input nativo (1 px) deja al usuario sin saber qué corregir.
      const custom = control.classList.contains('m3-native-select')
        ? control.nextElementSibling?.querySelector('.m3-select-trigger')
        : control.classList.contains('m3-native-datetime')
          ? control.nextElementSibling?.querySelector('.m3-datetime-trigger')
          : null;
      if (custom) {
        custom.classList.add('is-invalid');
        custom.setAttribute('aria-invalid', 'true');
        custom.focus();
      } else {
        control.reportValidity();
        control.focus();
      }
      return false;
    }
  }
  if (activeStep === 0) {
    const arrival = form.elements.fecha_inicio.value;
    const departure = form.elements.fecha_fin.value;
    if (arrival && departure && arrival >= departure) {
      form.elements.fecha_fin.setCustomValidity('La salida debe ser posterior al ingreso.');
      const customDate = form.elements.fecha_fin.nextElementSibling?.querySelector('.m3-datetime-trigger');
      if (customDate) {
        customDate.classList.add('is-invalid');
        customDate.setAttribute('aria-invalid', 'true');
        customDate.focus();
      } else {
        form.elements.fecha_fin.reportValidity();
      }
      form.elements.fecha_fin.setCustomValidity('');
      return false;
    }
  }
  if (activeStep === 1) {
    const manual = form.elements.usar_unidad_manual.checked;
    if (manual && !form.elements.unidad_manual.value.trim()) {
      const control = form.elements.unidad_manual;
      control.setCustomValidity('Ingresá una habitación.');
      const custom = control.classList.contains('m3-native-select')
        ? control.nextElementSibling?.querySelector('.m3-select-trigger') : null;
      if (custom) {
        custom.classList.add('is-invalid');
        custom.setAttribute('aria-invalid', 'true');
        custom.focus();
      } else {
        control.reportValidity();
        control.focus();
      }
      control.setCustomValidity('');
      return false;
    }
    if (!manual && !form.elements.unidad_id.value) {
      const control = form.elements.unidad_id;
      control.setCustomValidity('Seleccioná una habitación.');
      const custom = control.classList.contains('m3-native-select')
        ? control.nextElementSibling?.querySelector('.m3-select-trigger') : null;
      if (custom) {
        custom.classList.add('is-invalid');
        custom.setAttribute('aria-invalid', 'true');
        custom.focus();
      } else {
        control.reportValidity();
        control.focus();
      }
      control.setCustomValidity('');
      return false;
    }
  }
  return true;
}
function moveTo(index) {
  if (index > activeStep && !validateCurrentStep()) return;
  activeStep = Math.max(0, Math.min(index, steps.length - 1));
  showStep();
  document.querySelector('#reservationPageTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});
}
nextButton?.addEventListener('click', () => moveTo(activeStep + 1));
backButton?.addEventListener('click', () => moveTo(activeStep - 1));
window.addEventListener('resize', showStep);
showStep();
