import React, {type ReactNode, useMemo} from 'react';
import clsx from 'clsx';
import useIsBrowser from '@docusaurus/useIsBrowser';
import {translate} from '@docusaurus/Translate';
import IconLightMode from '@theme/Icon/LightMode';
import IconDarkMode from '@theme/Icon/DarkMode';
import IconSystemColorMode from '@theme/Icon/SystemColorMode';

import styles from './styles.module.css';

type ColorMode = 'dark' | 'light';
type ColorModeChoice = ColorMode | null;

interface ColorModeToggleInput {
  buttonClassName?: string;
  className?: string;
  onChange: (colorMode: ColorModeChoice) => void;
  respectPrefersColorScheme: boolean;
  value: ColorModeChoice;
}

interface ColorModeNextInput {
  colorMode: ColorModeChoice;
  respectPrefersColorScheme: boolean;
}

interface ColorModeLabelInput {
  colorMode: ColorModeChoice;
}

interface ColorModeResolvedInput {
  colorMode: ColorModeChoice;
  isBrowser: boolean;
}

interface ColorModeTooltipInput {
  colorMode: ColorModeChoice;
  isBrowser: boolean;
}

const getNextColorMode = ({colorMode, respectPrefersColorScheme}: ColorModeNextInput): ColorModeChoice => {
  if (!respectPrefersColorScheme) {
    return colorMode === 'dark' ? 'light' : 'dark';
  }

  switch (colorMode) {
    case null:
      return 'light';
    case 'light':
      return 'dark';
    case 'dark':
      return null;
    default:
      throw new Error(`unexpected color mode ${colorMode}`);
  }
};

const getColorModeLabel = ({colorMode}: ColorModeLabelInput): string => {
  switch (colorMode) {
    case null:
      return translate({
        id: 'theme.colorToggle.mode.system',
        message: 'auto (system)',
        description: 'Label for auto system color mode',
      });
    case 'light':
      return translate({
        id: 'theme.colorToggle.mode.light',
        message: 'light',
        description: 'Label for light color mode',
      });
    case 'dark':
      return translate({
        id: 'theme.colorToggle.mode.dark',
        message: 'dark',
        description: 'Label for dark color mode',
      });
    default:
      throw new Error(`unexpected color mode ${colorMode}`);
  }
};

const getResolvedColorMode = ({colorMode, isBrowser}: ColorModeResolvedInput): ColorMode => {
  if (colorMode === 'light' || colorMode === 'dark') {
    return colorMode;
  }

  if (!isBrowser) {
    return 'light';
  }

  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
};

const getColorModeAriaLabel = ({colorMode}: ColorModeLabelInput): string =>
  translate(
    {
      id: 'theme.colorToggle.ariaLabel',
      message: 'Switch color theme (currently {mode})',
      description: 'ARIA label for color mode toggle',
    },
    {mode: getColorModeLabel({colorMode})},
  );

const getColorModeTooltip = ({colorMode, isBrowser}: ColorModeTooltipInput): string => {
  if (colorMode === null) {
    const resolvedColorMode = getResolvedColorMode({colorMode, isBrowser});
    return translate(
      {
        id: 'theme.colorToggle.tooltip.system',
        message: 'Auto theme selected. Follows system preference (currently {resolved}).',
        description: 'Tooltip text for auto color mode',
      },
      {resolved: getColorModeLabel({colorMode: resolvedColorMode})},
    );
  }

  return translate(
    {
      id: 'theme.colorToggle.tooltip.fixed',
      message: '{mode} theme selected.',
      description: 'Tooltip text for fixed color mode',
    },
    {mode: getColorModeLabel({colorMode})},
  );
};

const CurrentColorModeIcon = (): ReactNode => (
  <>
    <IconLightMode
      aria-hidden
      className={clsx(styles.toggleIcon, styles.lightToggleIcon)}
    />
    <IconDarkMode
      aria-hidden
      className={clsx(styles.toggleIcon, styles.darkToggleIcon)}
    />
    <IconSystemColorMode
      aria-hidden
      className={clsx(styles.toggleIcon, styles.systemToggleIcon)}
    />
  </>
);

const ColorModeToggle = ({
  buttonClassName,
  className,
  onChange,
  respectPrefersColorScheme,
  value,
}: ColorModeToggleInput): ReactNode => {
  const isBrowser = useIsBrowser();

  const tooltip = useMemo(
    () => getColorModeTooltip({colorMode: value, isBrowser}),
    [isBrowser, value],
  );

  return (
    <div className={clsx(styles.toggle, className)}>
      <button
        aria-label={getColorModeAriaLabel({colorMode: value})}
        className={clsx(
          'clean-btn',
          styles.toggleButton,
          !isBrowser && styles.toggleButtonDisabled,
          buttonClassName,
        )}
        disabled={!isBrowser}
        onClick={() =>
          onChange(getNextColorMode({colorMode: value, respectPrefersColorScheme}))
        }
        title={tooltip}
        type="button"
      >
        <CurrentColorModeIcon />
      </button>
    </div>
  );
};

export default React.memo(ColorModeToggle);
