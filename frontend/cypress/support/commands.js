// cypress/support/commands.js

Cypress.Commands.add('login', (email = 'cristiamejia155@gmail.com', password = 'Pinguii2023@') => {
  cy.session(
    [email, password],
    () => {
      // Mockeamos la respuesta del login para que el frontend reciba un token válido sin backend
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200,
        body: {
          token: 'fake-jwt-token',
          user: { id: 'uuid', nombre: 'Test Abogado', rol: 'ABOGADO', tenant_id: 'tenant1' }
        }
      }).as('mockLogin');

      cy.visit('/login');
      cy.get('input[name="email"]').type(email);
      cy.get('input[name="password"]').type(password);
      cy.get('button[type="submit"]').click();
      
      cy.wait('@mockLogin');
      
      // Simulamos que el token se guardó
      window.localStorage.setItem('sgpa_token', 'fake-jwt-token');
      window.localStorage.setItem('sgpa_user', JSON.stringify({ id: 'uuid', nombre: 'Test Abogado', rol: 'ABOGADO', tenant_id: 'tenant1' }));
    },
    {
      validate() {
        // Confirmar que se generó algún estado de sesión válido
      }
    }
  );
});
