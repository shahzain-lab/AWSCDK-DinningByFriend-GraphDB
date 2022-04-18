#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { dinningByFriendMainStack } from '../lib/dinning_by_friend_main-Stack';

const app = new cdk.App();
new dinningByFriendMainStack(app, 'dinningByFriendMainStack');