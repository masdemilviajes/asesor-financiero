-- Asesor Financiero · Borrar TODOS los datos
-- Deja las tablas vacías (no borra tu usuario ni las tablas). Úsalo para
-- quitar los datos de ejemplo antes de cargar los tuyos. No se puede deshacer.

truncate table
  public.savings_contributions,
  public.savings_goals,
  public.scheduled_payments,
  public.categorization_rules,
  public.transactions,
  public.imports,
  public.categories,
  public.accounts;
