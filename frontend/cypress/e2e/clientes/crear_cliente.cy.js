describe('HU-04, HU-05: Creación de Clientes', () => {
  beforeEach(() => {
    // Usamos el custom command para iniciar sesión
    cy.login();
    // Interceptamos peticiones a clientes para que el test sea estable si el backend no está
    cy.intercept('GET', '/api/clientes*', {
      statusCode: 200,
      body: []
    }).as('getClientes');
    
    cy.visit('/clientes');
    // En Cypress para manejar errores de timeout usamos configuraciones o esperamos, no catch()
    // Como el endpoint no existe localmente a veces, dejemos que espere o falle si no está interceptado.
  });

  it('HU-04: Debe abrir el formulario y permitir crear un Cliente Natural', () => {
    // Interceptamos la creación
    cy.intercept('POST', '/api/clientes', {
      statusCode: 201,
      body: {
        id_cliente: 'client-123',
        nombre: 'Juan Perez',
        tipo_persona: 'NATURAL'
      }
    }).as('crearCliente');

    // Click en Nuevo Cliente
    cy.contains('Nuevo Cliente').click();

    // Verificamos que se abrió el modal y estamos en persona NATURAL
    cy.get('input[placeholder="Ej. Juan Pérez"]').should('be.visible').type('Juan Perez');
    
    // Seleccionar documento
    cy.get('select').select('CC');
    cy.get('input[placeholder="Ej. 10293847"]').type('1020304050');

    cy.get('input[type="email"]').type('juan.perez@test.com');
    cy.get('input[type="tel"]').type('3001234567');

    cy.contains('Guardar Cliente').click();

    // Verificamos que se llamó al API
    cy.wait('@crearCliente').then((interception) => {
      expect(interception.request.body).to.include({
        nombre: 'Juan Perez',
        tipo: 'NATURAL',
        numero_documento: '1020304050'
      });
    });

    cy.contains('Cliente creado exitosamente').should('exist');
  });

  it('HU-05: Debe cambiar formulario y permitir crear un Cliente Jurídico', () => {
    cy.intercept('POST', '/api/clientes', {
      statusCode: 201,
      body: {
        id_cliente: 'client-456',
        razon_social: 'Empresa SA',
        tipo_persona: 'JURIDICA'
      }
    }).as('crearEmpresa');

    cy.contains('Nuevo Cliente').click();

    // Cambiar a persona Jurídica
    cy.contains('Persona Jurídica').click();

    // Llenar campos de jurídica
    cy.get('input[placeholder="Ej. Inversiones SAS"]').type('Empresa SA');
    cy.get('input[placeholder="Ej. 900.123.456-7"]').type('900123456');
    cy.get('input[placeholder="Nombre completo"]').type('Representante Legal');

    cy.get('input[type="email"]').type('contacto@empresa.com');
    cy.get('input[type="tel"]').type('3001234567');

    cy.contains('Guardar Cliente').click();

    cy.wait('@crearEmpresa').then((interception) => {
      expect(interception.request.body).to.include({
        razon_social: 'Empresa SA',
        tipo: 'JURIDICA'
      });
    });

    cy.contains('Cliente creado exitosamente').should('exist');
  });
});
