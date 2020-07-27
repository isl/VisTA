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

/**
 * @author Philip Polkovnikov
 */

import * as React from 'react';
import * as _ from 'lodash';
import * as block from 'bem-cn';
import { uniq } from 'lodash';
import * as classNames from 'classnames';
import { Component, cloneElement } from 'react';
import { Modal } from 'react-bootstrap';
import SelectionActionComponent from 'platform/components/ui/selection/SelectionActionComponent';
import { MenuProps } from 'platform/components/ui/selection/SelectionActionProps';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { OverlayDialog } from 'platform/components/ui/overlay/OverlayDialog';
import { ActionProps, AllTitleProps, TypeProps } from './TypedSelectionActionProps';
import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';

export const ACTION_DIALOG_REF = 'dialog-action';

type Props = MenuProps & ActionProps & AllTitleProps & TypeProps

interface State {
  disabled: boolean
}

const QUERY = `
  SELECT (COUNT(DISTINCT $_iri) AS ?count) WHERE {
    $_iri a $_type.
  }
`;

export default class TypedSelectionActionComponent extends Component<Props, State> {
  constructor(props, context) {
    super(props, context);
    this.state = {
      disabled: false,
    };
    this.checkSelection(props);
  }

  componentWillReceiveProps(nextProps: Props) {
    if (!_.isEqual(nextProps.selection, this.props.selection)) {
      this.checkSelection(nextProps);
    }
  }

  private checkSelection = (props: Props) => {
    // if there's no type requirements, we don't need to validate them
    if (!props.selection || _.isEmpty(props.selection) || !props.types) {
      return;
    }
    const iris = props.selection.map((iri) => ({_iri: Rdf.iri(iri)}));
    const types = props.types.map((type) => ({_type: Rdf.iri(type)}));
    SparqlClient.prepareQuery(QUERY, iris)
      .map(SparqlClient.prepareParsedQuery(types))
      .flatMap(SparqlClient.select)
      .onValue((result) => {
        const bindings = result.results.bindings;
        const count = bindings && bindings[0] && bindings[0]['count']
          ? parseInt(bindings[0]['count'].value, 10) : 0;
        const expectedCount = uniq(props.selection).length;
        if (count !== expectedCount) {
          this.setState({disabled: true});
        }
      })
      .onError((err) => {
        console.error(err);
      });
  };

  render() {
    const disabled = this.state.disabled ||
      this.props.isDisabled(this.props.selection);
    return <SelectionActionComponent
      disabled={disabled}
      selection={this.props.selection}
      closeMenu={this.props.closeMenu}
      onAction={this.onAction}
      title={this.props.menuTitle}
    />;
  }

  private onAction = (selection: string[]) => {
    getOverlaySystem().show(
      ACTION_DIALOG_REF,
      this.renderDialog(selection)
    );
  }

  private renderDialog = (selection: string[]) => {
    if (this.props.renderDialog) {
      return <OverlayDialog
        show={true}
        title={this.props.title}
        type='lightbox'
        onHide={closeDialog}
      >
        {this.props.renderDialog(selection)}
      </OverlayDialog>
    } else if (this.props.renderRawDialog) {
      const dialog = this.props.renderRawDialog(selection);
      return cloneElement(dialog, {onHide: closeDialog});
    } else {
      console.error("SelectionActionComponent wasn't provided with dialog");
    }
  }
}

export function closeDialog() {
  getOverlaySystem().hide(ACTION_DIALOG_REF);
}
