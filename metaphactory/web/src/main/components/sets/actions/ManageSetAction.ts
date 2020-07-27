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

import { Component, Children, cloneElement } from 'react';

import { navigateToResource } from 'platform/api/navigation';

import {
  SetManagementContextTypes, SetManagementContext, SetViewContext, SetViewContextTypes,
} from '../SetManagementApi';

/**
 * Navigates to currently active set's page.
 *
 * @example
 * <mp-set-management-action-manage-set>
 *   <span>Manage set</span>
 * </mp-set-management-action-manage-set>
 */
export class ManageSetAction extends Component<{}, void> {
  static readonly contextTypes = {...SetManagementContextTypes, ...SetViewContextTypes};
  context: SetManagementContext & SetViewContext;

  private onClick = () => {
    const setIri = this.context['mp-set-management--set-view'].getCurrentSet();
    navigateToResource(setIri).onEnd(() => {/* activate */});
    closeAllOpenBootstrapDropdowns();
  }

  public render() {
    const child = Children.only(this.props.children);
    return cloneElement(child, {onClick: this.onClick});
  }
}

function closeAllOpenBootstrapDropdowns() {
  // simulate click outside any dropdowns;
  // see DropdownButton.rootCloseEvent property in React-Bootstrap docs
  document.dispatchEvent(new MouseEvent('click'));
}

export default ManageSetAction;
