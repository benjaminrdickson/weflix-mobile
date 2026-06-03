import { supabase } from './supabase';

const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function request(method, path, body = null, params = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  let url = `${BASE}/${path}`;
  if (params) {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    );
    const query = new URLSearchParams(filtered).toString();
    if (query) url += `?${query}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.response = { data, status: res.status };
    throw err;
  }

  return { data };
}

export const edgeFn = {
  get:    (path, params) => request('GET',    path, null,  params),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
};
