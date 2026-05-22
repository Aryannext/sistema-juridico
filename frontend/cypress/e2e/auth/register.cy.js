describe('HU-35: Registro en la plataforma (Tenant)', () => {
  beforeEach(() => {
    cy.visit('/registro');
  });

  it('Debe cambiar el formulario entre Independiente y Consultorio', () => {
    // Por defecto es INDEPENDIENTE, validamos que no esté el campo de consultorio
    cy.get('input#nombre_consultorio').should('not.exist');
    
    // Cambiamos a CONSULTORIO
    cy.contains('Consultorio Jurídico').click();
    cy.get('input#nombre_consultorio').should('exist');
    cy.get('input#nit').should('exist');
  });

  it('Debe registrar exitosamente un consultorio jurídico', () => {
    cy.intercept('POST', '/api/auth/registro', {
      statusCode: 201,
      body: { message: 'Registro exitoso. Tu cuenta ha sido auto-verificada para desarrollo local.' }
    }).as('registerRequest');

    cy.contains('Consultorio Jurídico').click();
    
    cy.get('input#nombre_consultorio').type('Mi Consultorio Cypress');
    cy.get('input#nombre_admin').type('Admin Cypress');
    cy.get('input#email').type('cypress@test.com');
    cy.get('input#password').type('Cypress2026!');
    cy.get('input#nit').type('900123456');

    cy.get('button[type="submit"]').click();

    cy.wait('@registerRequest').then((interception) => {
      expect(interception.request.body).to.include({
        tipo: 'CONSULTORIO',
        nombre_consultorio: 'Mi Consultorio Cypress',
        email: 'cypress@test.com'
      });
    });

    cy.contains('Registro exitoso').should('be.visible');
  });
});
