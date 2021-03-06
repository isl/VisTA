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

import { PropTypes } from 'react';

import * as TemplateService from 'platform/api/services/template';

/**
 * @author Alexey Morozov
 */
export interface TemplateContext {
  readonly templateScope: TemplateService.TemplateScope;
  readonly templateDataContext?: TemplateService.CapturedContext;
}

export const TemplateContextTypes: Readonly<Record<keyof TemplateContext, any>> = {
  templateScope: PropTypes.object,
  templateDataContext: PropTypes.object,
};
