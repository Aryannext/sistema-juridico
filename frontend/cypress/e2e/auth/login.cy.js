describe('HU-01: Inicio de sesión en el sistema', () => {
  beforeEach(() => {
    // Visit the public login route before each test
    cy.visit('/login');
  });

  it('Debe iniciar sesión exitosamente con credenciales válidas y redirigir al dashboard', () => {
    // We mock the API call so we don't need a running backend for the E2E test, 
    // or if the backend is running we can use it. Since we want an automated test
    // let's intercept the login API.
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        token: 'fake-token-123',
        user: { id: 'uuid', nombre: 'Test Abogado', rol: 'ABOGADO', tenant_id: 't1' }
      }
    }).as('loginRequest');

    cy.get('input[name="email"]').type('abogado@consultorio.com');
    cy.get('input[name="password"]').type('Abogado123!');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest');

    // Wait for redirect to dashboard
    cy.url().should('include', '/dashboard'); 
    cy.get('h1').contains('Bienvenido, Test Abogado').should('be.visible');
  });

  it('Debe mostrar un error genérico con credenciales inválidas por seguridad', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { error: 'Credenciales inválidas' }
    }).as('loginError');

    cy.get('input[name="email"]').type('abogado@consultorio.com');
    cy.get('input[name="password"]').type('claveIncorrecta!');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginError');

    // Generic error message should be visible (could be a toast or span)
    // Checking body contains the error
    cy.contains('Credenciales inválidas').should('be.visible');
    
    // URL should stay in login
    cy.url().should('include', '/login');
  });
});
