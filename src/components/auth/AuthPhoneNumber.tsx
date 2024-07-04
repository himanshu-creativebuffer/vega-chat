import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiCountryCode } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { LangCode } from '../../types';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import { pick } from '../../util/iteratees';
import { setLanguage } from '../../util/langProvider';
import { formatPhoneNumber, getCountryCodesByIso, getCountryFromPhoneNumber } from '../../util/phoneNumber';
import { IS_SAFARI, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLangString from '../../hooks/useLangString';

import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import Loading from '../ui/Loading';
import CountryCodeInput from './CountryCodeInput';

import monkeyPath from '../../assets/monkey.svg';
import Spinner from '../ui/Spinner';

type StateProps = Pick<GlobalState, (
  'connectionState' | 'authState' |
  'authPhoneNumber' | 'authIsLoading' |
  'authIsLoadingQrCode' | 'authError' |
  'authRememberMe' | 'authNearestCountry'
)> & {
  language?: LangCode;
  phoneCodeList: ApiCountryCode[];
};

const MIN_NUMBER_LENGTH = 7;

let isPreloadInitiated = false;

const AuthPhoneNumber: FC<StateProps> = ({
  connectionState,
  authState,
  authPhoneNumber,
  authIsLoading,
  authIsLoadingQrCode,
  authError,
  authRememberMe,
  authNearestCountry,
  phoneCodeList,
  language,
}) => {
  const {
    setAuthPhoneNumber,
    setAuthRememberMe,
    loadNearestCountry,
    loadCountryList,
    clearAuthError,
    goToAuthQrCode,
    setSettingOption,
  } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedLanguage = getSuggestedLanguage();

  const isConnected = connectionState === 'connectionStateReady';
  const continueText = useLangString(isConnected ? suggestedLanguage : undefined, 'ContinueOnThisLanguage', true);
  const [country, setCountry] = useState<ApiCountryCode | undefined>();
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [isTouched, setIsTouched] = useState(false);
  const [lastSelection, setLastSelection] = useState<[number, number] | undefined>();
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  // const fullNumber = country ? `+${country.countryCode} ${phoneNumber || ''}` : phoneNumber;
  const fullNumber = country ? `+${country.countryCode} ${phoneNumber || ''}` : phoneNumber;
  // fullNumber = "+639178944123";
  const canSubmit = fullNumber && fullNumber.replace(/[^\d]+/g, '').length >= MIN_NUMBER_LENGTH;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const phone = params.get('phnumber');

  useEffect(()=>{
    if (params && phone) {
      console.log(code,"code", phone, params)
      // parseFullNumber(phone);
      setPhoneNumber(phone)
    }
  }, [])

  useEffect(() => {
    if (!IS_TOUCH_ENV && !phone && !code) {
      inputRef.current!.focus();
    }
  }, [country]);

  useEffect(() => {
    if (isConnected && !authNearestCountry) {
      loadNearestCountry();
    }
  }, [isConnected, authNearestCountry]);

  useEffect(() => {
    if (isConnected) {
      loadCountryList({ langCode: language });
    }
  }, [isConnected, language]);

  useEffect(() => {
    if (authNearestCountry && phoneCodeList && !country && !isTouched) {
      setCountry(getCountryCodesByIso(phoneCodeList, authNearestCountry)[0]);
    }
  }, [country, authNearestCountry, isTouched, phoneCodeList]);

  const parseFullNumber = useCallback((newFullNumber: string) => {
    if (!newFullNumber.length) {
      setPhoneNumber('');
    }

    const suggestedCountry = phoneCodeList && getCountryFromPhoneNumber(phoneCodeList, newFullNumber);

    // Any phone numbers should be allowed, in some cases ignoring formatting
    const selectedCountry = !country
    || (suggestedCountry && suggestedCountry.iso2 !== country.iso2)
    || (!suggestedCountry && newFullNumber.length)
      ? suggestedCountry
      : country;

    if (!country || !selectedCountry || (selectedCountry && selectedCountry.iso2 !== country.iso2)) {
      setCountry(selectedCountry);
    }
    setPhoneNumber(formatPhoneNumber(newFullNumber, selectedCountry));
  }, [phoneCodeList, country]);

  const handleLangChange = useCallback(() => {
    markIsLoading();

    void setLanguage(suggestedLanguage, () => {
      unmarkIsLoading();

      setSettingOption({ language: suggestedLanguage });
    });
  }, [markIsLoading, setSettingOption, suggestedLanguage, unmarkIsLoading]);

  useEffect(() => {
    if (phoneNumber === undefined && authPhoneNumber) {
      parseFullNumber(authPhoneNumber);
    } else {
      onSaveWithNumber();
    }
  }, [authPhoneNumber, phoneNumber, parseFullNumber]);

  useLayoutEffect(() => {
    if (inputRef.current && lastSelection) {
      inputRef.current.setSelectionRange(...lastSelection);
    }
  }, [lastSelection]);

  const isJustPastedRef = useRef(false);
  const handlePaste = useCallback(() => {
    isJustPastedRef.current = true;
    requestMeasure(() => {
      isJustPastedRef.current = false;
    });
  }, []);

  const onSaveWithNumber = () =>{
    const validLength = country?.patterns?.[0].replace(" ", "").length;
    const validNumber = phoneNumber?.replace(" ", "").length;
    if (phoneNumber && validNumber === validLength) {
      handleSubmit();
    }
  }

  const handleCountryChange = useCallback((value: ApiCountryCode) => {
    setCountry(value);
    setPhoneNumber('');
  }, []);

  const handlePhoneNumberChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (authError) {
      clearAuthError();
    }

    // This is for further screens. We delay it until user input to speed up the initial loading.
    if (!isPreloadInitiated) {
      isPreloadInitiated = true;
      preloadFonts();
      void preloadImage(monkeyPath);
    }

    const { value, selectionStart, selectionEnd } = e.target;
    setLastSelection(
      selectionStart && selectionEnd && selectionEnd < value.length
        ? [selectionStart, selectionEnd]
        : undefined,
    );

    setIsTouched(true);

    const shouldFixSafariAutoComplete = (
      IS_SAFARI && country && fullNumber !== undefined
      && value.length - fullNumber.length > 1 && !isJustPastedRef.current
    );
    parseFullNumber(shouldFixSafariAutoComplete ? `${country ? country!.countryCode : code} ${value}` : value);
  }, [authError, clearAuthError, country, fullNumber, parseFullNumber]);

  const handleKeepSessionChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAuthRememberMe(e.target.checked);
  }, [setAuthRememberMe]);

  function handleSubmit() {
    // event.preventDefault();

    if (authIsLoading) {
      return;
    }

    if (canSubmit) {
      setAuthPhoneNumber({ phoneNumber: fullNumber });
    }
  }

  const handleGoToAuthQrCode = useCallback(() => {
    goToAuthQrCode();
  }, [goToAuthQrCode]);

  const isAuthReady = authState === 'authorizationStateWaitPhoneNumber';

  return (
    <>
      {phone && code ? <div className='spinnerContainer'><Spinner className='bigSpinner' color={'white'} /></div> : <div id="auth-phone-number-form" className="custom-scroll">
      <div className="auth-form">
        <div id="logo" />
        <h1>VEGA Chat</h1>
        <p className="note">{lang('StartText')}</p>
        <form className="form" action="">
        <label>{lang('Login.SelectCountry.Title')}</label>
          <CountryCodeInput
            id="sign-in-phone-code"
            value={country}
            isLoading={!authNearestCountry && !country}
            onChange={handleCountryChange}
          />
          <label>{lang('Login.PhonePlaceholder')}</label>
          <InputText
            ref={inputRef}
            id="sign-in-phone-number"
            // label={lang('Login.PhonePlaceholder')}
            value={fullNumber}
            error={authError && lang(authError)}
            inputMode="tel"
            onChange={handlePhoneNumberChange}
            onPaste={IS_SAFARI ? handlePaste : undefined}
          />
          <Checkbox
            id="sign-in-keep-session"
            label="Keep me signed in"
            checked={Boolean(authRememberMe)}
            onChange={handleKeepSessionChange}
          />
          {authIsLoading && <Button ripple isLoading={authIsLoading}>""</Button>}
          {/* {canSubmit && (
            isAuthReady ? (
              <Button type="submit" ripple isLoading={authIsLoading}>{lang('Login.Next')}</Button>
            ) : (
              <Loading />
            )
          )} */}
          {/* {isAuthReady && (
            <Button isText ripple isLoading={authIsLoadingQrCode} onClick={handleGoToAuthQrCode}>
              {lang('Login.QR.Login')}
            </Button>
          )} */}
          {suggestedLanguage && suggestedLanguage !== language && continueText && (
            <Button isText isLoading={isLoading} onClick={handleLangChange}>{continueText}</Button>
          )}
        </form>
      </div>
    </div>}
    </>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      settings: { byKey: { language } },
      countryList: { phoneCodes: phoneCodeList },
    } = global;

    return {
      ...pick(global, [
        'connectionState',
        'authState',
        'authPhoneNumber',
        'authIsLoading',
        'authIsLoadingQrCode',
        'authError',
        'authRememberMe',
        'authNearestCountry',
      ]),
      language,
      phoneCodeList,
    };
  },
)(AuthPhoneNumber));
