import { supabase } from './supabase';

export async function logAudit(
  action: string,
  recordType?: string,
  recordId?: string,
  description?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc('log_audit', {
      p_action: action,
      p_record_type: recordType ?? null,
      p_record_id: recordId ?? null,
      p_description: description ?? null,
      p_metadata: metadata ?? null,
    });
  } catch {
    // Audit logging should never break the main operation
  }
}
