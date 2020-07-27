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

import { DOM as D, createFactory, Component, ReactNode } from 'react';
import * as ReactBootstrap from 'react-bootstrap';
import * as bem from 'bem-cn';

const label = createFactory(ReactBootstrap.Label);
const row = createFactory(ReactBootstrap.Row);
const col = createFactory(ReactBootstrap.Col);

export const CLASS_NAME = 'field-editor';
const block = bem(CLASS_NAME);

interface RowState {
  readonly collapsed?: boolean;
}

interface Props {
  collapsible?: boolean;
  onExpand?: () => void;
  label: string;
  error?: Error;
  element: ReactNode;
}

class FieldRow extends Component<Props, RowState> {

  constructor(props: Props) {
    super(props);
    this.state = {collapsed: Boolean(this.props.collapsible)};
  }

  componentDidMount() {
    if (!this.props.collapsible) {
      this.expand();
    }
  }

  componentWillReceiveProps(nextProps: Props, nextState: RowState) {
    if (this.props.collapsible && !nextProps.collapsible) {
      // expand if row becomes non-collapsible
      this.expand();
    }
  }

  render() {
    return row({
        className: block('row').toString(),
      },
      col({
          md: 3,
          onClick: this.expand,
        },
        label({}, this.props.label)
      ),
      col({
          md: 9,
        },
        this.props.error
          ? row({className: block('error').toString()},
              D.i({}, this.props.error.message)
            )
          : null,
        row({},
          this.state.collapsed ? D.i(
            {
              className: block('expand').toString(),
              onClick: this.expandIfPossible,
            },
            `Click to add an optional ${this.props.label}.`,
          ) : this.props.element,
        )
      ) // end col
    );
  }

  private expandIfPossible = () => {
    if (this.props.collapsible) {
      this.expand();
    }
  }

  private expand() {
    this.setState({collapsed: false});
    if (this.props.onExpand) {
      this.props.onExpand();
    }
  }
}

export default createFactory(FieldRow);
