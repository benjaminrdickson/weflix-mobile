import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { edgeFn } from '../lib/edgeFunctions';

const OnboardingContext = createContext(null);

const KEYS = {
  introSeen:       'onboarding_intro_seen',
  promptSeen:      'onboarding_prompt_seen',
  isSkipper:       'onboarding_is_skipper',
  partnerNudgeDead:'onboarding_partner_nudge_dead',
  groupNudgeDead:  'onboarding_group_nudge_dead',
};

const NULL_VALUE = {
  introSeen: true,
  shouldShowPrompt: false,
  partnerNudge: { pulseKey: 0, bubbleText: null },
  groupNudge:   { pulseKey: 0, bubbleText: null },
  markIntroSeen:    () => {},
  markPromptSeen:   () => {},
  markSkipper:      () => {},
  killPartnerNudge: () => {},
  killGroupNudge:   () => {},
  notifyCardAction: () => {},
};

export function OnboardingProvider({ children, isAuthenticated }) {
  const [loaded, setLoaded] = useState(false);

  const [introSeen,        setIntroSeen]        = useState(true);
  const [promptSeen,       setPromptSeen]       = useState(true);
  const [isSkipper,        setIsSkipper]        = useState(false);
  const [partnerNudgeDead, setPartnerNudgeDead] = useState(false);
  const [groupNudgeDead,   setGroupNudgeDead]   = useState(false);

  // Session counters — never trigger re-renders; reset on each app open
  const sessionLikes  = useRef(0);
  const sessionSwipes = useRef(0);

  // Prompt has fired this session
  const [promptTriggered, setPromptTriggered] = useState(false);

  // Backend banked-like count (partner context only, for nudge)
  const [partnerLikeCount, setPartnerLikeCount] = useState(0);
  const nextNudgeAt = useRef(20);

  // Nudge display state
  const [partnerNudge, setPartnerNudge] = useState({ pulseKey: 0, bubbleText: null });
  const [groupNudge,   setGroupNudge]   = useState({ pulseKey: 0, bubbleText: null });

  // Ref mirrors — read inside the stable notifyCardAction callback
  const promptSeenRef       = useRef(true);
  const promptTriggeredRef  = useRef(false);
  const isSkipperRef        = useRef(false);
  const pNudgeDeadRef       = useRef(false);
  const gNudgeDeadRef       = useRef(false);
  const likeCountRef        = useRef(0);

  useEffect(() => { promptSeenRef.current      = promptSeen;       }, [promptSeen]);
  useEffect(() => { promptTriggeredRef.current = promptTriggered;  }, [promptTriggered]);
  useEffect(() => { isSkipperRef.current       = isSkipper;        }, [isSkipper]);
  useEffect(() => { pNudgeDeadRef.current      = partnerNudgeDead; }, [partnerNudgeDead]);
  useEffect(() => { gNudgeDeadRef.current      = groupNudgeDead;   }, [groupNudgeDead]);
  useEffect(() => { likeCountRef.current       = partnerLikeCount; }, [partnerLikeCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    AsyncStorage.multiGet(Object.values(KEYS)).then(pairs => {
      const map = Object.fromEntries(pairs);
      const intro    = map[KEYS.introSeen]        === 'true';
      const prompt   = map[KEYS.promptSeen]       === 'true';
      const skipper  = map[KEYS.isSkipper]        === 'true';
      const pnd      = map[KEYS.partnerNudgeDead] === 'true';
      const gnd      = map[KEYS.groupNudgeDead]   === 'true';

      setIntroSeen(intro);
      setPromptSeen(prompt);
      promptSeenRef.current = prompt;
      setIsSkipper(skipper);
      isSkipperRef.current = skipper;
      setPartnerNudgeDead(pnd);
      pNudgeDeadRef.current = pnd;
      setGroupNudgeDead(gnd);
      gNudgeDeadRef.current = gnd;
      setLoaded(true);
    });
  }, [isAuthenticated]);

  // On app open, fetch backend like count to seed the nudge threshold
  useEffect(() => {
    if (!loaded || !isSkipper || partnerNudgeDead) return;
    edgeFn.get('likes').then(({ data }) => {
      const count = data.count ?? 0;
      setPartnerLikeCount(count);
      likeCountRef.current = count;
      nextNudgeAt.current = (Math.floor(count / 20) + 1) * 20;
    }).catch(() => {});
  }, [loaded, isSkipper, partnerNudgeDead]);

  const markIntroSeen = useCallback(() => {
    setIntroSeen(true);
    AsyncStorage.setItem(KEYS.introSeen, 'true');
  }, []);

  const markPromptSeen = useCallback(() => {
    setPromptSeen(true);
    promptSeenRef.current = true;
    AsyncStorage.setItem(KEYS.promptSeen, 'true');
  }, []);

  const markSkipper = useCallback(() => {
    setIsSkipper(true);
    isSkipperRef.current = true;
    AsyncStorage.setItem(KEYS.isSkipper, 'true');
  }, []);

  const killPartnerNudge = useCallback(() => {
    setPartnerNudgeDead(true);
    pNudgeDeadRef.current = true;
    setPartnerNudge({ pulseKey: 0, bubbleText: null });
    AsyncStorage.setItem(KEYS.partnerNudgeDead, 'true');
  }, []);

  const killGroupNudge = useCallback(() => {
    setGroupNudgeDead(true);
    gNudgeDeadRef.current = true;
    setGroupNudge({ pulseKey: 0, bubbleText: null });
    AsyncStorage.setItem(KEYS.groupNudgeDead, 'true');
  }, []);

  // Stable callback: reads from refs, never recreated
  const notifyCardAction = useCallback((type, context) => {
    // Any card action dismisses active nudge bubbles
    setPartnerNudge(prev => prev.bubbleText ? { ...prev, bubbleText: null } : prev);
    setGroupNudge(prev => prev.bubbleText ? { ...prev, bubbleText: null } : prev);

    sessionSwipes.current += 1;
    if (type === 'like' && context === 'partner') {
      sessionLikes.current += 1;
    }

    // First-run prompt trigger (pre-skip phase)
    if (!promptSeenRef.current && !promptTriggeredRef.current) {
      if (sessionLikes.current >= 5 || sessionSwipes.current >= 20) {
        promptTriggeredRef.current = true;
        setPromptTriggered(true);
      }
    }

    // Skipper nudge trigger (post-skip, partner likes only)
    if (isSkipperRef.current && type === 'like' && context === 'partner') {
      const newCount = likeCountRef.current + 1;
      likeCountRef.current = newCount;
      setPartnerLikeCount(newCount);

      if (newCount >= nextNudgeAt.current) {
        nextNudgeAt.current += 20;

        if (!pNudgeDeadRef.current) {
          setPartnerNudge(prev => ({
            pulseKey: prev.pulseKey + 1,
            bubbleText: `${newCount} likes. Invite Partner!`,
          }));
        }
        if (!gNudgeDeadRef.current) {
          setGroupNudge(prev => ({
            pulseKey: prev.pulseKey + 1,
            bubbleText: 'Invite Friends!',
          }));
        }
      }
    }
  }, []);

  const shouldShowPrompt = promptTriggered && !promptSeen;

  const value = loaded && isAuthenticated
    ? {
        introSeen,
        shouldShowPrompt,
        partnerNudge,
        groupNudge,
        markIntroSeen,
        markPromptSeen,
        markSkipper,
        killPartnerNudge,
        killGroupNudge,
        notifyCardAction,
      }
    : NULL_VALUE;

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
