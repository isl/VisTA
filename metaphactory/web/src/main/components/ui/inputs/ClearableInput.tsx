/*
 * Copyright (C) 2015-2017, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import * as React from 'react';
import { HTMLAttributes, CSSProperties } from 'react';

import './clearable-input.scss';

export interface ClearableInputProps extends HTMLAttributes<HTMLInputElement> {
  className?: string;
  style?: CSSProperties;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  clearTitle?: string;
  onClear: () => void;
}

const CLASS_NAME = 'clearable-input';

export class ClearableInput extends React.Component<ClearableInputProps, void> {
  static defaultProps: Partial<ClearableInputProps> = {
    clearTitle: 'Clear input',
  };

  render() {
    const {
      className, style, inputClassName, inputStyle, onClear, clearTitle,
      ...inputProps,
    } = this.props;

    const groupClassName = `${CLASS_NAME} form-group has-feedback ${className || ''}`;
    const controlClassName = `${CLASS_NAME}__input form-control ${inputClassName || ''}`;
    return <div className={groupClassName} style={style}>
      <input type='text' {...inputProps} className={controlClassName} style={inputStyle}></input>
      <span className={`${CLASS_NAME}__clear form-control-feedback`}
        title={clearTitle} onClick={onClear}>
        <span className='fa fa-times' aria-hidden='true'></span>
      </span>
    </div>;
  }
}
