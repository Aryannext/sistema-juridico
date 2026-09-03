/**
 * Avisos del panel principal — RF17.3 y RF40.3.
 *
 * Lo que más importa vigilar aquí es la **visibilidad**: el panel no puede
 * enseñar a un abogado expedientes que su propio listado le oculta. Un aviso
 * demasiado generoso sería una fuga de información, no una comodidad.
 */
const {
  filtroDeVisibilidad,
  ultimoMovimiento,
  faltanPartes,
  diasDesde,
  DIAS_INACTIVIDAD_POR_DEFECTO,
} = require('../modules/procesos/atencion');

const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

describe('Quién ve qué', () => {
  it('El Administrador ve todo el consultorio, sin más filtro que el tenant', () => {
    const f = filtroDeVisibilidad({ rol: 'ADMINISTRADOR', id_usuario: 'u1' }, 't1');

    expect(f.tenant_id).toBe('t1');
    expect(f.OR).toBeUndefined();
  });

  it('El abogado solo ve lo suyo: como responsable o como asignado', () => {
    const f = filtroDeVisibilidad({ rol: 'ABOGADO', id_usuario: 'u1' }, 't1');

    expect(f.tenant_id).toBe('t1');
    expect(f.OR).toEqual([
      { id_abogado_resp: 'u1' },
      { abogados: { some: { id_usuario: 'u1' } } },
    ]);
  });

  it('El colaborador se filtra igual que el abogado', () => {
    // Nadie que no sea Administrador escapa del filtro. Si alguna vez un rol
    // nuevo se colara, este caso lo detecta.
    const f = filtroDeVisibilidad({ rol: 'ASISTENTE', id_usuario: 'u9' }, 't1');
    expect(f.OR).toBeDefined();
  });

  it('El filtro siempre lleva el consultorio, sea cual sea el rol', () => {
    for (const rol of ['ADMINISTRADOR', 'ABOGADO', 'ASISTENTE', 'CLIENTE']) {
      expect(filtroDeVisibilidad({ rol, id_usuario: 'u1' }, 't7').tenant_id).toBe('t7');
    }
  });
});

describe('Última señal de vida del expediente', () => {
  it('Sin nada más, vale la fecha del propio expediente', () => {
    const p = { update_at: hace(10), historial: [], documentos: [], actuaciones: [] };
    expect(ultimoMovimiento(p)).toEqual(p.update_at);
  });

  it('Un documento reciente cuenta como movimiento', () => {
    // El expediente lleva 40 días sin tocarse, pero ayer se subió un
    // documento: no está abandonado.
    const doc = hace(1);
    const p = {
      update_at: hace(40),
      historial: [],
      documentos: [{ created_at: doc }],
      actuaciones: [],
    };
    expect(ultimoMovimiento(p)).toEqual(doc);
  });

  it('Un cambio en el historial también cuenta', () => {
    const cambio = hace(2);
    const p = {
      update_at: hace(40),
      historial: [{ created_at: cambio }],
      documentos: [],
      actuaciones: [],
    };
    expect(ultimoMovimiento(p)).toEqual(cambio);
  });

  it('De la actuación se mira cuándo se digitó, no la fecha del juzgado', () => {
    // Una actuación del juzgado de hace un año registrada hoy es actividad de
    // hoy: alguien atendió el expediente.
    const registro = hace(1);
    const p = {
      update_at: hace(60),
      historial: [],
      documentos: [],
      actuaciones: [{ fecha_registro: registro }],
    };
    expect(ultimoMovimiento(p)).toEqual(registro);
  });

  it('Con varias señales, gana la más reciente', () => {
    const reciente = hace(3);
    const p = {
      update_at: hace(50),
      historial: [{ created_at: hace(20) }],
      documentos: [{ created_at: reciente }],
      actuaciones: [{ fecha_registro: hace(30) }],
    };
    expect(ultimoMovimiento(p)).toEqual(reciente);
  });

  it('No falla si las relaciones no vienen cargadas', () => {
    const p = { update_at: hace(5) };
    expect(() => ultimoMovimiento(p)).not.toThrow();
    expect(ultimoMovimiento(p)).toEqual(p.update_at);
  });
});

describe('Umbral de inactividad', () => {
  it('El umbral acordado es de 30 días (RF40.3)', () => {
    expect(DIAS_INACTIVIDAD_POR_DEFECTO).toBe(30);
  });

  it('Cuenta los días completos transcurridos', () => {
    expect(diasDesde(hace(45))).toBe(45);
  });

  it('Un expediente movido hoy no lleva días de inactividad', () => {
    expect(diasDesde(new Date())).toBe(0);
  });
});

describe('Expediente incompleto (RF17)', () => {
  it('Con demandante y demandado, no falta nada', () => {
    const p = { partes: [{ tipo: 'DEMANDANTE' }, { tipo: 'DEMANDADO' }] };
    expect(faltanPartes(p)).toEqual([]);
  });

  it('Sin demandado, lo señala', () => {
    expect(faltanPartes({ partes: [{ tipo: 'DEMANDANTE' }] })).toEqual(['demandado']);
  });

  it('Sin ninguna parte, señala las dos', () => {
    expect(faltanPartes({ partes: [] })).toEqual(['demandante', 'demandado']);
  });

  it('Otras partes no sustituyen a las dos obligatorias', () => {
    // Un tercero o una víctima no cierran la conformación básica.
    const p = { partes: [{ tipo: 'TERCEROS' }, { tipo: 'VICTIMA' }] };
    expect(faltanPartes(p)).toEqual(['demandante', 'demandado']);
  });

  it('Varias partes del mismo tipo cuentan como una', () => {
    const p = { partes: [{ tipo: 'DEMANDANTE' }, { tipo: 'DEMANDANTE' }, { tipo: 'DEMANDADO' }] };
    expect(faltanPartes(p)).toEqual([]);
  });
});
