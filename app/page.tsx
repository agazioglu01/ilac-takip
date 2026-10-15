'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Check,
  Plus,
  Pencil,
  Trash2,
  Pill,
  Clock,
  Cloud,
  CloudOff,
  AlertTriangle,
  Calendar as CalendarIcon,
  RotateCcw,
  X,
  CheckCheck,
  LogOut,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type TimeSlot = 'Sabah' | 'Öğle' | 'Akşam' | 'Gece';

export interface Medication {
  id: string;
  name: string;
  dosage_per_take: number;
  time_slots: TimeSlot[];
  notes: string;
  current_stock: number | null;
  is_active: boolean;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  log_date: string;
  time_slot: TimeSlot;
  taken_count: number;
  taken_at: string;
}

const TIME_SLOTS_ORDER: TimeSlot[] = ['Sabah', 'Öğle', 'Akşam', 'Gece'];

const QUICK_NOTE_SUGGESTIONS = [
  'Yemekten 1 saat sonra',
  'Yemekten yarım saat önce',
  'Aç karnına',
  'Tok karnına',
  'Yemekle birlikte',
  'Bol su ile',
];

const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: 'seed-pentasa',
    name: 'Pentasa',
    dosage_per_take: 3,
    time_slots: ['Sabah', 'Akşam'],
    notes: 'Yemekten 1 saat sonra',
    current_stock: 120,
    is_active: true,
  },
  {
    id: 'seed-imuran',
    name: 'Imuran',
    dosage_per_take: 1,
    time_slots: ['Sabah', 'Akşam'],
    notes: 'Tok karnına',
    current_stock: 60,
    is_active: true,
  },
];

const getLocalDateString = (date: Date): string => {
  return date.toLocaleDateString('en-CA');
};

export default function PillTrackerApp() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [dataError, setDataError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authView, setAuthView] = useState<'sign-in' | 'request-reset' | 'set-password'>(
    'sign-in'
  );
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const authenticatedUserId = authUser?.id;
  const [todayDate, setTodayDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'local'>('local');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  const [formName, setFormName] = useState<string>('');
  const [formDosage, setFormDosage] = useState<number>(1);
  const [formSlots, setFormSlots] = useState<TimeSlot[]>(['Sabah', 'Akşam']);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('');

  const weekDays = todayDate
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${todayDate}T00:00:00`);
        d.setDate(d.getDate() - (6 - i));
        return {
          dateStr: getLocalDateString(d),
          dayName: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
          dayNumber: d.getDate(),
        };
      })
    : [];

  const persistLocalData = (nextMedications: Medication[], nextLogs: MedicationLog[]) => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('pill_medications', JSON.stringify(nextMedications));
    localStorage.setItem('pill_logs', JSON.stringify(nextLogs));
  };

  const loadData = useCallback(
    async (userId?: string, isActive: () => boolean = () => true) => {
      setIsLoading(true);
      setDataError('');
      try {
        if (supabase) {
          if (!userId) return;
          setSyncStatus('syncing');
          const [
            { data: medsData, error: medsError },
            { data: logsData, error: logsError },
          ] = await Promise.all([
            supabase
              .from('medications')
              .select('*')
              .eq('user_id', userId)
              .eq('is_active', true)
              .order('created_at'),
            supabase.from('medication_logs').select('*').eq('user_id', userId),
          ]);

          if (medsError) throw medsError;
          if (logsError) throw logsError;
          if (!isActive()) return;
          setMedications(medsData ?? []);
          setLogs(logsData ?? []);
          setSyncStatus('synced');
        } else {
          const savedMeds = localStorage.getItem('pill_medications');
          const savedLogs = localStorage.getItem('pill_logs');
          const nextMedications = savedMeds
            ? (JSON.parse(savedMeds) as Medication[])
            : INITIAL_MEDICATIONS;
          const nextLogs = savedLogs ? (JSON.parse(savedLogs) as MedicationLog[]) : [];

          if (!isActive()) return;
          setMedications(nextMedications);
          setLogs(nextLogs);
          persistLocalData(nextMedications, nextLogs);
          setSyncStatus('local');
        }
      } catch (error) {
        console.error('Veriler yüklenemedi:', error);
        if (isActive()) {
          setDataError('Veriler yüklenemedi. Bağlantını kontrol edip sayfayı yenile.');
          setSyncStatus('local');
        }
      } finally {
        if (isActive()) setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (isActive) {
        const today = getLocalDateString(new Date());
        setTodayDate(today);
        setSelectedDate(today);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let isActive = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;
      setAuthUser(session?.user ?? null);
      setAuthError('');
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('set-password');
        setAuthNotice('');
      }
      setMedications([]);
      setLogs([]);
      setIsLoading(true);
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) return;
        if (error) {
          console.error('Oturum bilgisi alınamadı:', error);
          setAuthError('Oturum bilgisi alınamadı. Sayfayı yenileyip tekrar dene.');
          setAuthUser(null);
        } else {
          setAuthUser(data.session?.user ?? null);
        }
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        console.error('Oturum bilgisi alınamadı:', error);
        setAuthError('Oturum bilgisi alınamadı. Sayfayı yenileyip tekrar dene.');
        setAuthUser(null);
        setAuthReady(true);
      });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let isActive = true;
    if (isSupabaseConfigured && !authenticatedUserId) {
      queueMicrotask(() => {
        if (isActive) setIsLoading(false);
      });
      return () => {
        isActive = false;
      };
    }

    queueMicrotask(() => {
      if (isActive) void loadData(authenticatedUserId, () => isActive);
    });
    return () => {
      isActive = false;
    };
  }, [authReady, authenticatedUserId, loadData]);

  useEffect(() => {
    const client = supabase;
    if (!client || !authUser) return;

    let isActive = true;
    const filter = `user_id=eq.${authUser.id}`;
    const channel = client
      .channel(`realtime_pill_tracker_${authUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medications', filter },
        () => {
          if (isActive) void loadData(authUser.id, () => isActive);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medication_logs', filter },
        () => {
          if (isActive) void loadData(authUser.id, () => isActive);
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void client.removeChannel(channel);
    };
  }, [authUser, loadData]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get('error_code') !== 'otp_expired') return;

    queueMicrotask(() => {
      setAuthView('request-reset');
      setAuthError('Bağlantının süresi dolmuş veya daha önce kullanılmış. Yeni bir parola sıfırlama e-postası iste.');
    });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAuthError('Supabase ayarları bulunamadı.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setAuthBusy(false);
    if (error) {
      console.error('Giriş başarısız:', error);
      setAuthError('Giriş yapılamadı. E-posta ve parolanı kontrol et.');
    } else {
      setLoginPassword('');
    }
  };

  const handleRequestPasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAuthError('Supabase ayarları bulunamadı.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: window.location.origin,
    });
    setAuthBusy(false);
    if (error) {
      console.error('Parola sıfırlama e-postası gönderilemedi:', error);
      setAuthError(`Parola sıfırlama e-postası gönderilemedi: ${error.message}`);
      return;
    }
    setAuthNotice('Adres kayıtlıysa parola yenileme bağlantısı gönderildi. Gelen kutusu ve spam klasörünü kontrol et.');
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAuthError('Supabase ayarları bulunamadı.');
      return;
    }
    if (newPassword.length < 8) {
      setAuthError('Yeni parola en az 8 karakter olmalı.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError('Parolalar eşleşmiyor.');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAuthBusy(false);
    if (error) {
      console.error('Parola güncellenemedi:', error);
      setAuthError('Parola güncellenemedi. Sıfırlama bağlantısının süresi dolmuş olabilir; yeni bir bağlantı iste.');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setAuthView('sign-in');
    setAuthNotice('Parolan güncellendi. Artık yeni parolanla giriş yapabilirsin.');
    await supabase.auth.signOut();
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Oturum kapatılamadı:', error);
      setAuthError('Oturum kapatılamadı. Tekrar dene.');
    }
  };

  const toggleDose = async (med: Medication, slot: TimeSlot) => {
    const existingLog = logs.find(
      (l) => l.medication_id === med.id && l.log_date === selectedDate && l.time_slot === slot
    );

    if (existingLog) {
      const updatedLogs = logs.filter((l) => l.id !== existingLog.id);
      const updatedMeds = medications.map((m) =>
        m.id === med.id && m.current_stock !== null
          ? { ...m, current_stock: m.current_stock + existingLog.taken_count }
          : m
      );

      setLogs(updatedLogs);
      setMedications(updatedMeds);
      persistLocalData(updatedMeds, updatedLogs);

      if (isSupabaseConfigured && supabase) {
        setSyncStatus('syncing');
        await supabase.from('medication_logs').delete().eq('id', existingLog.id);
        const targetMed = updatedMeds.find((m) => m.id === med.id);
        if (targetMed && targetMed.current_stock !== null) {
          await supabase
            .from('medications')
            .update({ current_stock: targetMed.current_stock })
            .eq('id', med.id);
        }
        setSyncStatus('synced');
      }
    } else {
      const newLog: MedicationLog = {
        id: crypto.randomUUID(),
        medication_id: med.id,
        log_date: selectedDate,
        time_slot: slot,
        taken_count: med.dosage_per_take,
        taken_at: new Date().toISOString(),
      };

      const updatedLogs = [...logs, newLog];
      const updatedMeds = medications.map((m) =>
        m.id === med.id && m.current_stock !== null
          ? { ...m, current_stock: Math.max(0, m.current_stock - med.dosage_per_take) }
          : m
      );

      setLogs(updatedLogs);
      setMedications(updatedMeds);
      persistLocalData(updatedMeds, updatedLogs);

      if (isSupabaseConfigured && supabase) {
        setSyncStatus('syncing');
        const { data: inserted } = await supabase
          .from('medication_logs')
          .upsert(
            {
              medication_id: med.id,
              log_date: selectedDate,
              time_slot: slot,
              taken_count: med.dosage_per_take,
              taken_at: newLog.taken_at,
            },
            { onConflict: 'medication_id,log_date,time_slot' }
          )
          .select()
          .single();

        if (inserted) {
          setLogs((prev) => prev.map((l) => (l.id === newLog.id ? inserted : l)));
        }

        const targetMed = updatedMeds.find((m) => m.id === med.id);
        if (targetMed && targetMed.current_stock !== null) {
          await supabase
            .from('medications')
            .update({ current_stock: targetMed.current_stock })
            .eq('id', med.id);
        }
        setSyncStatus('synced');
      }
    }
  };

  const markAllSlotAsTaken = async (slot: TimeSlot, medsInSlot: Medication[]) => {
    for (const med of medsInSlot) {
      const isAlreadyTaken = logs.some(
        (l) => l.medication_id === med.id && l.log_date === selectedDate && l.time_slot === slot
      );
      if (!isAlreadyTaken) {
        await toggleDose(med, slot);
      }
    }
  };

  const openAddModal = () => {
    setEditingMed(null);
    setFormName('');
    setFormDosage(1);
    setFormSlots(['Sabah', 'Akşam']);
    setFormNotes('');
    setFormStock('');
    setIsModalOpen(true);
  };

  const openEditModal = (med: Medication, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMed(med);
    setFormName(med.name);
    setFormDosage(med.dosage_per_take);
    setFormSlots(med.time_slots);
    setFormNotes(med.notes || '');
    setFormStock(med.current_stock !== null ? String(med.current_stock) : '');
    setIsModalOpen(true);
  };

  const toggleFormSlot = (slot: TimeSlot) => {
    setFormSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formSlots.length === 0) return;

    const sortedSlots = TIME_SLOTS_ORDER.filter((s) => formSlots.includes(s));
    const parsedStock = formStock.trim() !== '' ? parseInt(formStock, 10) : null;

    if (editingMed) {
      const updatedMed: Medication = {
        ...editingMed,
        name: formName.trim(),
        dosage_per_take: formDosage,
        time_slots: sortedSlots,
        notes: formNotes.trim(),
        current_stock: parsedStock,
      };

      const updatedList = medications.map((m) => (m.id === editingMed.id ? updatedMed : m));
      setMedications(updatedList);
      persistLocalData(updatedList, logs);
      setIsModalOpen(false);

      if (isSupabaseConfigured && supabase) {
        setSyncStatus('syncing');
        await supabase
          .from('medications')
          .update({
            name: updatedMed.name,
            dosage_per_take: updatedMed.dosage_per_take,
            time_slots: updatedMed.time_slots,
            notes: updatedMed.notes,
            current_stock: updatedMed.current_stock,
          })
          .eq('id', editingMed.id);
        setSyncStatus('synced');
      }
    } else {
      const newMed: Medication = {
        id: crypto.randomUUID(),
        name: formName.trim(),
        dosage_per_take: formDosage,
        time_slots: sortedSlots,
        notes: formNotes.trim(),
        current_stock: parsedStock,
        is_active: true,
      };

      const updatedList = [...medications, newMed];
      setMedications(updatedList);
      persistLocalData(updatedList, logs);
      setIsModalOpen(false);

      if (isSupabaseConfigured && supabase) {
        setSyncStatus('syncing');
        const { data: inserted } = await supabase
          .from('medications')
          .insert({
            name: newMed.name,
            dosage_per_take: newMed.dosage_per_take,
            time_slots: newMed.time_slots,
            notes: newMed.notes,
            current_stock: newMed.current_stock,
            is_active: true,
          })
          .select()
          .single();

        if (inserted) {
          setMedications((prev) => prev.map((m) => (m.id === newMed.id ? inserted : m)));
        }
        setSyncStatus('synced');
      }
    }
  };

  const handleDeleteMedication = async (medId: string) => {
    const updatedList = medications.filter((m) => m.id !== medId);
    setMedications(updatedList);
    const updatedLogs = logs.filter((log) => log.medication_id !== medId);
    setLogs(updatedLogs);
    persistLocalData(updatedList, updatedLogs);
    setIsModalOpen(false);

    if (isSupabaseConfigured && supabase) {
      setSyncStatus('syncing');
      await supabase.from('medications').delete().eq('id', medId);
      setSyncStatus('synced');
    }
  };

  const totalScheduledDoses = medications.reduce((acc, m) => acc + m.time_slots.length, 0);
  const totalScheduledPills = medications.reduce(
    (acc, m) => acc + m.time_slots.length * m.dosage_per_take,
    0
  );

  const logsForSelectedDate = logs.filter((l) => l.log_date === selectedDate);
  const completedDosesCount = logsForSelectedDate.length;
  const completedPillsCount = logsForSelectedDate.reduce((acc, l) => acc + l.taken_count, 0);

  const progressPercentage =
    totalScheduledDoses > 0 ? Math.round((completedDosesCount / totalScheduledDoses) * 100) : 0;

  if (isSupabaseConfigured && authView === 'set-password') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <form
          onSubmit={handleUpdatePassword}
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <div className="mb-6 text-center">
            <Pill className="mx-auto mb-3 h-9 w-9 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Yeni parola belirle</h1>
            <p className="mt-1 text-sm text-slate-400">Hesabın için yeni bir parola oluştur.</p>
          </div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm text-slate-300">
            Yeni parola
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
          />
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm text-slate-300">
            Yeni parola (tekrar)
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
          />
          {authError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authBusy}
            className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authBusy ? 'Parola güncelleniyor...' : 'Parolayı güncelle'}
          </button>
        </form>
      </main>
    );
  }

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Pill className="w-10 h-10 text-emerald-400 animate-bounce" />
          <p className="text-sm text-slate-400">İlaç listesi yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured && !authUser) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <form
          onSubmit={
            authView === 'request-reset' ? handleRequestPasswordReset : handleSignIn
          }
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <div className="mb-6 text-center">
            <Pill className="mx-auto mb-3 h-9 w-9 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">
              {authView === 'request-reset' ? 'Parolanı yenile' : 'İlaç Takibim'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {authView === 'request-reset'
                ? 'Parola yenileme bağlantısını e-posta adresine gönderelim.'
                : 'Devam etmek için hesabınla giriş yap.'}
            </p>
          </div>

          <label htmlFor="login-email" className="mb-1.5 block text-sm text-slate-300">
            E-posta
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
          />

          {authView === 'sign-in' && (
            <>
              <label htmlFor="login-password" className="mb-1.5 block text-sm text-slate-300">
                Parola
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
              />
            </>
          )}

          {authError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {authError}
            </p>
          )}
          {authNotice && (
            <p role="status" className="mt-4 rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">
              {authNotice}
            </p>
          )}

          <button
            type="submit"
            disabled={authBusy}
            className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authBusy
              ? authView === 'request-reset'
                ? 'E-posta gönderiliyor...'
                : 'Giriş yapılıyor...'
              : authView === 'request-reset'
                ? 'Yenileme bağlantısı gönder'
                : 'Giriş yap'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthView(authView === 'request-reset' ? 'sign-in' : 'request-reset');
              setAuthError('');
              setAuthNotice('');
            }}
            className="mt-4 w-full text-center text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
          >
            {authView === 'request-reset' ? 'Giriş ekranına dön' : 'Parolamı unuttum'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 selection:bg-emerald-500/30">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <header className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Pill className="w-6 h-6 text-emerald-400" />
              İlaç Takibim
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Günlük doz, öğün notu ve stok kontrolü
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                syncStatus === 'synced'
                  ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-300'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-950/60 border-amber-800/70 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {syncStatus === 'synced' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bulut Aktif</span>
                </>
              ) : syncStatus === 'syncing' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                  <span>Eşitleniyor...</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Yerel Hafıza</span>
                </>
              )}
            </div>

            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-semibold px-3.5 py-2 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>İlaç Ekle</span>
            </button>
            {authUser && (
              <button
                onClick={handleSignOut}
                aria-label="Oturumu kapat"
                title={authUser.email ?? 'Oturumu kapat'}
                className="rounded-xl border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {dataError && (
          <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            {dataError}
          </p>
        )}

        <div className="grid grid-cols-7 gap-1.5 mb-5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800/80">
          {weekDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            const isToday = day.dateStr === todayDate;
            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDate(day.dateStr)}
                className={`flex flex-col items-center py-2 rounded-xl transition ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'hover:bg-slate-800/70 text-slate-400'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {day.dayName}
                </span>
                <span className="text-base font-bold mt-0.5">{day.dayNumber}</span>
                {isToday && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      isSelected ? 'bg-slate-950' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-4 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">
                {selectedDate === todayDate ? 'Bugünkü İlerleme' : selectedDate}
              </span>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              %{progressPercentage} Tamamlandı
            </span>
          </div>

          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Öğün Dozu: <strong className="text-slate-200">{completedDosesCount}</strong> /{' '}
              {totalScheduledDoses}
            </span>
            <span>
              Toplam İçilen Hap:{' '}
              <strong className="text-emerald-400">{completedPillsCount}</strong> /{' '}
              {totalScheduledPills} adet
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {TIME_SLOTS_ORDER.map((slot) => {
            const medsInSlot = medications.filter((m) => m.time_slots.includes(slot));
            if (medsInSlot.length === 0) return null;

            const allTakenInSlot = medsInSlot.every((m) =>
              logsForSelectedDate.some((l) => l.medication_id === m.id && l.time_slot === slot)
            );

            return (
              <section key={slot} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <h2 className="text-base font-bold text-white tracking-wide">
                      {slot} İlaçları
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      ({medsInSlot.length} ilaç)
                    </span>
                  </div>

                  {!allTakenInSlot && (
                    <button
                      onClick={() => markAllSlotAsTaken(slot, medsInSlot)}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Tümünü İçtim</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {medsInSlot.map((med) => {
                    const logEntry = logsForSelectedDate.find(
                      (l) => l.medication_id === med.id && l.time_slot === slot
                    );
                    const isTaken = Boolean(logEntry);
                    const takenTimeStr = logEntry
                      ? new Date(logEntry.taken_at).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : null;

                    const isLowStock =
                      med.current_stock !== null &&
                      med.current_stock <= med.dosage_per_take * med.time_slots.length * 5;

                    return (
                      <div
                        key={`${med.id}-${slot}`}
                        onClick={() => toggleDose(med, slot)}
                        className={`group relative rounded-2xl p-4 border transition-all cursor-pointer select-none ${
                          isTaken
                            ? 'bg-emerald-950/30 border-emerald-700/60 shadow-sm'
                            : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <button
                              type="button"
                              aria-label={`${med.name} içildi işaretle`}
                              className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                isTaken
                                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 scale-105'
                                  : 'bg-slate-800 border-2 border-slate-700 text-transparent group-hover:border-emerald-500/60'
                              }`}
                            >
                              <Check className="w-5 h-5 stroke-[3]" />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-lg font-bold tracking-tight transition ${
                                    isTaken ? 'line-through text-slate-400' : 'text-white'
                                  }`}
                                >
                                  {med.name}
                                </span>

                                {med.notes && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    {med.notes}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                                    isTaken
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                  }`}
                                >
                                  {logEntry ? logEntry.taken_count : med.dosage_per_take} Adet
                                </span>

                                {isTaken && takenTimeStr && (
                                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                                    ✓ {takenTimeStr}&apos;de içildi
                                  </span>
                                )}

                                {med.current_stock !== null && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                      isLowStock
                                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold'
                                        : 'text-slate-400 bg-slate-800/70'
                                    }`}
                                  >
                                    {isLowStock && <AlertTriangle className="w-3 h-3" />}
                                    Kalan: {med.current_stock} hap
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => openEditModal(med, e)}
                            title="Dozu veya açıklamayı düzenle"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Düzenle</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-10 pt-6 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Tanımlı İlaçlarım ve Günlük Dozlar
            </h3>
            <button
              onClick={() => setSelectedDate(todayDate)}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Bugüne Dön
            </button>
          </div>

          <div className="space-y-2">
            {medications.map((med) => (
              <div
                key={med.id}
                className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">{med.name}</span>
                    {med.notes && (
                      <span className="text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {med.notes}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Günde {med.time_slots.length} defa ({med.time_slots.join(', ')}) • Seferde{' '}
                    <strong className="text-slate-200">{med.dosage_per_take} adet</strong> (Günlük
                    toplam {med.time_slots.length * med.dosage_per_take} adet)
                  </p>
                </div>

                <button
                  onClick={(e) => openEditModal(med, e)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 transition shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Dozu / Notu Değiştir</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-emerald-400" />
                {editingMed ? `${editingMed.name} Düzenle` : 'Yeni İlaç Ekle'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  İlaç Adı
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Pentasa, Imuran..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                  İlaç Adının Yanında Görünecek Not (Opsiyonel)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Yemekten 1 saat sonra, Aç karnına..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_NOTE_SUGGESTIONS.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setFormNotes(suggestion)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                        formNotes === suggestion
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Hangi Öğünlerde İçilecek?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS_ORDER.map((slot) => {
                    const active = formSlots.includes(slot);
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => toggleFormSlot(slot)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                          active
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Her Öğünde Kaç Adet İçilecek?
                </label>
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <button
                    type="button"
                    onClick={() => setFormDosage((d) => Math.max(1, d - 1))}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg"
                  >
                    -
                  </button>
                  <div className="text-center">
                    <span className="text-xl font-extrabold text-emerald-400">
                      {formDosage} Adet
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Günlük toplam: {formDosage * formSlots.length} adet
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormDosage((d) => d + 1)}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Elimdeki Toplam Hap Sayısı (Opsiyonel Stok Takibi)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Örn: 120"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {editingMed && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMedication(editingMed.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-semibold text-sm border border-rose-500/30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sil</span>
                  </button>
                )}

                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
                >
                  {editingMed ? 'Değişiklikleri Kaydet' : 'İlacı Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}