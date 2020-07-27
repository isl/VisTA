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

import { Props as ReactProps, Component, ReactElement,
         cloneElement, DOM as D } from 'react';
import { OrderedMap } from 'immutable';

interface Props extends ReactProps<OverlaySystem> {

}

interface State {
  dialogs: OrderedMap<string, ReactElement<any>>;
}

/**
 * This is the holder of temporary top-level component, as dialog or overlay
 * OverlaySystem should be placed high in DOM tree to avoid being detached by react.
 * (now it's done in App.ts)
 *
 * Multiple overlays can be displayed at the same time.
 */
export class OverlaySystem extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dialogs: OrderedMap<string, ReactElement<any>>(),
    };
  }

  render() {
    return D.div({}, this.state.dialogs
      .map((modal, key) => cloneElement(modal, {key}))
      .toArray());
  }

  public show = (key: string, dialog: ReactElement<any>) => {
    this.setState({
      dialogs: this.state.dialogs.set(key, dialog),
    });
  }

  public hide = (key: string) => {
    this.setState({
      dialogs: this.state.dialogs.remove(key),
    });
  }

  public hideAll = () => {
    this.setState({
      dialogs: this.state.dialogs.clear(),
    });
  }
}

export default OverlaySystem;
